import Task from "../models/Task.js";
import User from "../models/User.js";
import { applyStreakOnTaskComplete } from "../services/streakService.js";

export async function listTasks(req, res, next) {
  try {
    const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (e) {
    next(e);
  }
}

export async function createTask(req, res, next) {
  try {
    const { title } = req.body;
    const task = await Task.create({ userId: req.userId, title });
    res.status(201).json({ task });
  } catch (e) {
    next(e);
  }
}

/** Toggle completed */
export async function toggleTask(req, res, next) {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    const wasCompleted = task.completed;
    task.completed = !task.completed;
    await task.save();

    let userPayload = null;
    if (!wasCompleted && task.completed) {
      const user = await User.findById(req.userId);
      if (user) {
        applyStreakOnTaskComplete(user);
        user.totalTasksCompleted = (user.totalTasksCompleted || 0) + 1;
        await user.save();
        userPayload = {
          streak: user.streak,
          lastActiveDate: user.lastActiveDate,
          totalTasksCompleted: user.totalTasksCompleted,
        };
      }
    }

    res.json({ task, user: userPayload });
  } catch (e) {
    next(e);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
