import {
  getLapCompanyForUser,
  getLapCompanyTlds,
  getSubDomainForUser,
  User,
  LapRole,
  LapUser,
  LapCompany,
} from './lapUtils';
import { getDomain } from 'tldjs';

const generateUser = (email: string, lapRole: LapRole): User => {
  const subDomain = getSubDomainForUser(email);
  return {
    email,
    subDomain,
    tld: getDomain(subDomain),
    lapRole,
  };
};
const generateLapCompany = (index: number, users: Array<User>): LapCompany => ({
  ID: index,
  Name: `Company${index}`,
  UsersList: users.map((user: User): LapUser => ({
    Role: user.lapRole,
    Email: user.email,
  })),
});

describe('getLapCompanyTlds', async () => {
  it('should return single TLD if all admins have same TLD', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('p1@paypal.com', 'Admin'),
      generateUser('p2@paypal.com', 'Admin'),
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(['paypal.com']);
  });

  it('should return single TLD if all admins have same TLD even if there are subdomain differences', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('p1@it.paypal.com', 'Admin'),
      generateUser('p2@sales.paypal.com', 'Admin'),
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(['paypal.com']);
  });

  it('should return single TLD if all admins have same TLD even if there are non-admins with different TLD', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('p1@paypal.com', 'Admin'),
      generateUser('p2@paypal.com', 'Admin'),
      generateUser('g1@google.com', 'Standard'),
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(['paypal.com']);
  });

  it('should error if company has admins with different TLDs', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('p1@paypal.com', 'Admin'),
      generateUser('g1@google.com', 'Admin'),
    ]);
    try {
      getLapCompanyTlds(lapCompany);
    } catch (error) {
      expect(error.message).toBe('Company has multiple TLDs');
    }
  });

  it('should error if company has no admins', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('p1@paypal.com', 'Standard'),
      generateUser('g1@google.com', 'Standard'),
    ]);
    try {
      getLapCompanyTlds(lapCompany);
    } catch (error) {
      expect(error.message).toBe('Company has no admins');
    }
  });
});

describe('getLapCompanyForUser', async () => {
  const userEmail = 'e1@ebay.com'; // User requesting to onboard.
  const rootAccountTLDs = ['ebay.com']; // The TLDs associated to the user's root account.

  it('should return null if LAP returns no companies', () => {
    const lapResponse = [];
    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toBe(null);
  });

  it('should return null if LAP returns no companies that user belongs to', () => {
    const lapResponse = [generateLapCompany(0, [generateUser('g1@google.com', 'Admin')])];
    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toBe(null);
  });

  it(`should return one company as admin if LAP returns one company as admin and company has no foreign TLDs`, () => {
    const lapResponse = [generateLapCompany(0, [generateUser(userEmail, 'Admin')])];
    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });

  it(`should error if LAP returns one company as admin but company has foreign TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Admin'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    try {
      getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-3: User has one LAP company association as ADMIN but that company has foreign TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should return one company as standard if LAP returns one company as standard', () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
    ];
    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard',
    });
  });

  it(`should error if LAP returns one company as standard but company has foreign TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Standard'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    try {
      getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-4: User has one LAP company association as STANDARD but that company has foreign TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should return one company as admin if LAP returns multiple companies but only one is admin.  That company has no foreign TLDs.', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(userEmail, 'Admin')]),
      generateLapCompany(1, [generateUser(userEmail, 'Standard')]),
    ];
    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });

  it(`should error if LAP returns multiple companies but only one is admin and the one admin company has foregin TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Admin'),
        generateUser('g1@google.com', 'Admin'),
      ]),
      generateLapCompany(1, [generateUser(userEmail, 'Standard')]),
    ];

    try {
      getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-3: User has one LAP company association as ADMIN but that company has foreign TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should error if LAP returns multiple companies with admin status for more than one', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(userEmail, 'Admin')]),
      generateLapCompany(1, [generateUser(userEmail, 'Admin')]),
    ];

    try {
      getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe('Error 19-1: User has multiple LAP company associations as ADMIN');
    }
  });

  it('should error if LAP returns multiple companies and user is not an admin for any', () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
      generateLapCompany(1, [
        generateUser(userEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
    ];

    try {
      getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        'Error 19-2: User has multiple LAP company associations as STANDARD',
      );
    }
  });

  it(`should return one company if LAP returns multiple companies and user is not an admin for any but only one company has no foreign TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
      generateLapCompany(1, [
        generateUser(userEmail, 'Standard'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    expect(getLapCompanyForUser(lapResponse, userEmail, rootAccountTLDs)).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard',
    });
  });

  // TODO: Scenario 11 from https://gitlab.com/hpe-aruba-get/asp-backend/issues/372 when business decides what to do.

  it(`should return one company if LAP returns one company that has multiple TLDs but all exist in the root account's TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(userEmail, 'Admin'),
        generateUser('p1@paypal.com', 'Admin'),
      ]),
    ];

    expect(
      // Note that 'abc.com' doesn't exist in the LAP company and it doesn't cause any violation errors.
      getLapCompanyForUser(lapResponse, userEmail, ['ebay.com', 'paypal.com', 'abc.com']),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });
});
