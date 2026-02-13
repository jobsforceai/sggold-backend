import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, type IUser } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";

export interface AuthPayload {
  userId: string;
  accountType: "regular" | "jeweller";
}

export interface AuthResult {
  user: { id: string; phone: string; name: string; email?: string; accountType: string };
  token: string;
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as string & jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}

function toUserResponse(user: IUser) {
  return {
    id: String(user._id),
    phone: user.phone,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    jewellerStatus: user.jewellerStatus,
    jewellerSubscriptionSlabPaise: user.jewellerSubscriptionSlabPaise,
  };
}

export async function registerUser(data: {
  phone: string;
  password: string;
  name: string;
  email?: string;
}): Promise<AuthResult> {
  const existing = await User.findOne({ phone: data.phone });
  if (existing) {
    throw new Error("Phone number already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    phone: data.phone,
    passwordHash,
    name: data.name,
    email: data.email,
    accountType: "regular",
    isActive: true,
  });

  await Wallet.create({
    userId: user._id,
    balanceMg: 0,
    totalPurchasedMg: 0,
    totalBonusMg: 0,
  });

  const token = generateToken({ userId: String(user._id), accountType: user.accountType });
  return { user: toUserResponse(user), token };
}

export async function loginUser(phone: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ phone });
  if (!user) {
    throw new Error("Invalid phone number or password");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid phone number or password");
  }

  const token = generateToken({ userId: String(user._id), accountType: user.accountType });
  return { user: toUserResponse(user), token };
}

export async function getUserById(userId: string) {
  const user = await User.findById(userId);
  if (!user) return null;
  return toUserResponse(user);
}

export async function updateUserProfile(userId: string, data: { name?: string; email?: string }) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (data.name) user.name = data.name;
  if (data.email !== undefined) user.email = data.email;
  await user.save();

  return toUserResponse(user);
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
}

export async function requestJewellerAccount(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.accountType === "jeweller" && user.jewellerStatus === "approved") {
    throw new Error("Already an approved jeweller");
  }

  if (user.jewellerStatus === "pending") {
    throw new Error("Jeweller request already pending");
  }

  user.jewellerStatus = "pending";
  await user.save();

  return toUserResponse(user);
}
