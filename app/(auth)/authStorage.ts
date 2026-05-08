const USERS_KEY = 'marketplace_auth_users_v2';
const SESSION_KEY = 'marketplace_auth_session';

// Module-level storage that persists across component re-renders
let users: any[] = [];
let currentUser: any = null;

export async function getUsers() {
  return users;
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 symbol' };
  }
  return { valid: true };
}

export async function registerUser(user: any) {
  const emailNormalized = user.email.trim().toLowerCase();
  
  const exists = users.find(u => u.email === emailNormalized);
  
  if (exists) throw new Error('You already have an account. Sign in instead.');

  const passwordValidation = validatePassword(user.password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  const newUser = {
    id: Date.now().toString(),
    name: user.name || user.fullName,
    email: emailNormalized,
    password: user.password.trim(),
    createdAt: Date.now(),
  };

  users.push(newUser);
  
  console.log('USERS AFTER REGISTER:', users);
  
  // Verify the user was saved
  const verify = users.find(u => u.email === emailNormalized);
  if (!verify) {
    throw new Error('SAVE FAILED');
  }
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  console.log('LOGIN ATTEMPT:', { normalizedEmail, normalizedPassword });
  console.log('STORED USERS:', users.map(u => ({ email: u.email, password: u.password })));

  const user = users.find(
    u =>
      u.email === normalizedEmail &&
      String(u.password).trim() === normalizedPassword
  );

  if (!user) {
    const emailExists = users.find(u => u.email === normalizedEmail);
    if (emailExists) {
      throw new Error('Invalid credentials');
    } else {
      throw new Error('Account not found');
    }
  }

  return user;
}

export async function socialLogin(provider: string, email?: string, providerId?: string) {
  if (!email || !providerId) {
    throw new Error(`${provider} authentication failed`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if user already exists with this provider
  const existingUser = users.find(u => u.email === normalizedEmail);
  
  if (existingUser) {
    console.log('EXISTING SOCIAL USER:', existingUser);
    return existingUser;
  }
  
  // Create new social user
  const newUser = {
    id: Date.now().toString(),
    name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
    email: normalizedEmail,
    password: '',
    provider: provider,
    providerId: providerId,
    createdAt: Date.now(),
  };
  
  users.push(newUser);
  
  console.log('SOCIAL USER CREATED:', newUser);
  
  return newUser;
}

export async function checkEmailExists(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return users.find(u => u.email === normalizedEmail);
}

// Session management
export function setCurrentSession(user: any) {
  currentUser = user;
  console.log('SESSION: User session set', user);
}

export function getCurrentSession() {
  return currentUser;
}

export function clearSession() {
  currentUser = null;
  console.log('SESSION: User session cleared');
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

