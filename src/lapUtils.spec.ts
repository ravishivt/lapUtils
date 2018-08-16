import {
  getUsersLapCompany,
  getLapCompanyTlds,
  getUsersSubDomain,
  User,
  LapRole,
  LapUser,
  LapCompany
} from './lapUtils';
import { getDomain } from 'tldjs';

const generateUser = (email: string, lapRole: LapRole): User => {
  const subDomain = getUsersSubDomain(email);
  return {
    email,
    subDomain,
    tld: getDomain(subDomain),
    lapRole,
  };
};
const generateLapCompany = (
  index: number,
  users: Array<User>
): LapCompany => ({
  ID: index,
  Name: `Company${index}`,
  UsersList: users.map((user: User): LapUser => ({
    Role: user.lapRole,
    Email: user.email
  })),
});

describe('getLapCompanyTlds', async () => {
  it('should return single TLD if all admins have same TLD', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('u1@paypal.com', 'Admin'),
      generateUser('u2@paypal.com', 'Admin')
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(
      ['paypal.com']
    );
  });

  it('should return single TLD if all admins have same TLD even if there are subdomain differences', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('u1@it.paypal.com', 'Admin'),
      generateUser('u2@sales.paypal.com', 'Admin')
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(
      ['paypal.com']
    );
  });

  it('should return single TLD if all admins have same TLD even if there are non-admins with different TLD', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('u1@paypal.com', 'Admin'),
      generateUser('u2@paypal.com', 'Admin'),
      generateUser('u1@google.com', 'Standard')
    ]);
    expect(getLapCompanyTlds(lapCompany)).toEqual(
      ['paypal.com']
    );
  });

  it('should error if company has admins with different TLDs', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('u1@paypal.com', 'Admin'),
      generateUser('u1@google.com', 'Admin')
    ]);
    try {
      getLapCompanyTlds(lapCompany)
    } catch (error) {
      expect(error.message).toBe('Company has multiple TLDs');
    }
  });

  it('should error if company has no admins', () => {
    const lapCompany = generateLapCompany(0, [
      generateUser('u1@paypal.com', 'Standard'),
      generateUser('u1@google.com', 'Standard')
    ]);
    try {
      getLapCompanyTlds(lapCompany)
    } catch (error) {
      expect(error.message).toBe('Company has no admins');
    }
  });
});

describe('getUsersLapCompany', async () => {
  const onboardingUserEmail = 'u1@ebay.com';
  const onboardingUsersRootAccountTlds = ['ebay.com'];

  it('should return null if LAP returns no companies', () => {
    const lapResponse = [];
    expect(getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)).toBe(
      null
    );
  });

  it('should return null if LAP returns no companies that user belongs to', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser('u1@google.com', 'Admin')])
    ];
    expect(getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)).toBe(
      null
    );
  });

  it('should return one company as admin if LAP returns one company as admin', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')])
    ];
    expect(
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin'
    });
  });

  it('should return one company as standard if LAP returns one company as standard', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@ebay.com', 'Admin')])
    ];
    expect(
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard'
    });
  });

  it('should return one company as admin if LAP returns multiple companies but only one is admin', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')])
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard')])
    ];
    expect(
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Admin'
    });
  });

  it('should error if LAP returns multiple companies with admin status for more than one', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Admin')])
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Admin')])
    ];

    try {
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    } catch (error) {
      expect(error.message).toBe('Error 19-1: User has multiple LAP company associations as ADMIN');
    }
  });

  it('should error if LAP returns multiple companies and user is not an admin for any', () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@ebay.com', 'Admin')])
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@ebay.com', 'Admin')])
    ];

    try {
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds);
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).toBe('Error 19-2: User has multiple LAP company associations as STANDARD');
    }
  });

  it(`should return one company if LAP returns multiple companies and user is not an admin for any but only one company matches the root acccount's TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@ebay.com', 'Admin')])
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@google.com', 'Admin')])
    ];

    expect(
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard'
    });
  });

  it(`should return one company if LAP returns multiple companies and user is not an admin for any but only one company matches the root acccount's TLDs`, () => {
    const lapResponse = [
      generateLapCompany(0, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@ebay.com', 'Admin')])
      generateLapCompany(1, [generateUser(onboardingUserEmail, 'Standard'), generateUser('u2@google.com', 'Admin'), generateUser('u3@amazon.com', 'Admin')])
    ];

    expect(
      getUsersLapCompany(lapResponse, onboardingUserEmail, onboardingUsersRootAccountTlds)
    ).toEqual({
      companyId: 0,
      companyName: 'Company0',
      role: 'Standard'
    });
  });
});
