import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { applyStreakOnLogin } from "../services/streakService.js";

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    streak: user.streak,
    lastActiveDate: user.lastActiveDate,
    totalTasksCompleted: user.totalTasksCompleted,
    createdAt: user.createdAt,
  };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = signToken(user._id);
    res.status(201).json({ token, user: userResponse(user) });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    applyStreakOnLogin(user);
    await user.save();
    const token = signToken(user._id);
    res.json({
      token,
      user: userResponse(user),
    });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(401).json({ error: "User not found" });
    applyStreakOnLogin(user);
    await user.save();
    res.json({ user: userResponse(user) });
  } catch (e) {
    next(e);
  }
}
