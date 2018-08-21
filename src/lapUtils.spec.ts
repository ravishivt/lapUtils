import {
  getUserLapCompany,
  getLapCompanyTlds,
  getUserSubDomain,
  User,
  LapRole,
  LapUser,
  LapCompany,
} from './lapUtils';
import { getDomain } from 'tldjs';

const generateUser = (email: string, lapRole: LapRole): User => {
  const subDomain = getUserSubDomain(email);
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

describe('getUserLapCompany', async () => {
  const onboardingUserEmail = 'e1@ebay.com';
  const onboardingUsersRootAccountTlds = ['ebay.com'];

  it('should return null if LAP returns no companies', () => {
    const lapResponse = [];
    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toBe(null);
  });

  it('should return null if LAP returns no companies that user belongs to', () => {
    const lapResponse = [generateLapCompany(0, [generateUser('g1@google.com', 'Admin')])];
    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toBe(null);
  });

  it(`should return one company as admin if LAP returns one company as admin and company's TLDs are OK`, () => {
    const lapResponse = [generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')])];
    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });

  it(`should error if LAP returns one company as admin but company has TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Admin'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    try {
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-3: User has one LAP company association as ADMIN but that company has TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should return one company as standard if LAP returns one company as standard', () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
    ];
    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard',
    });
  });

  it(`should error if LAP returns one company as standard but company has TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    try {
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-4: User has one LAP company association as STANDARD but that company has TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should return one company as admin if LAP returns multiple companies but only one is admin', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')]),
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard')]),
    ];
    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });

  it(`should error if LAP returns multiple companies but only one is admin and the one admin company has TLDs not in user's root account.`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Admin'),
        generateUser('g1@google.com', 'Admin'),
      ]),
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard')]),
    ];

    try {
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        `Error 19-3: User has one LAP company association as ADMIN but that company has TLDs not in the root account's TLDs`,
      );
    }
  });

  it('should error if LAP returns multiple companies with admin status for more than one', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')]),
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Admin')]),
    ];

    try {
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe('Error 19-1: User has multiple LAP company associations as ADMIN');
    }
  });

  it('should error if LAP returns multiple companies and user is not an admin for any', () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
      generateLapCompany(1, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
    ];

    try {
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe(
        'Error 19-2: User has multiple LAP company associations as STANDARD',
      );
    }
  });

  it(`should return one company if LAP returns multiple companies and user is not an admin for any but only one company matches the root acccount's TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('e2@ebay.com', 'Admin'),
      ]),
      generateLapCompany(1, [
        generateUser(onboardingUserEmail, 'Standard'),
        generateUser('g1@google.com', 'Admin'),
      ]),
    ];

    expect(
      getUserLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard',
    });
  });
  it(`should still return one company if LAP returns a company that has multiple TLDs but all exist in the root account's TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [
        generateUser(onboardingUserEmail, 'Admin'),
        generateUser('p1@paypal.com', 'Admin'),
      ]),
    ];

    expect(
      // Note that 'abc.com' doesn't exist in the LAP company and it doesn't cause any violation errors.
      getUserLapCompany(lapResponse, onboardingUserEmail, ['ebay.com', 'paypal.com', 'abc.com']),
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin',
    });
  });
});
