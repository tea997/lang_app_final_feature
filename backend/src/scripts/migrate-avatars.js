import mongoose from "mongoose";
import "dotenv/config";
import User from "../models/User.js";

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is missing.");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB. Fetching users...");

    const users = await User.find({ profilePic: { $regex: "avatar.iran.liara.run" } });
    console.log(`Found ${users.length} users with old avatar URLs.`);

    let updatedCount = 0;
    for (const user of users) {
      const oldUrl = user.profilePic;
      const match = oldUrl.match(/\/public\/(\d+)\.png/);
      const seed = match ? match[1] : Math.floor(Math.random() * 100) + 1;
      const newUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;

      await User.findByIdAndUpdate(user._id, { profilePic: newUrl });
      console.log(`Updated ${user.fullName} (${user.email}): ${oldUrl} -> ${newUrl}`);
      updatedCount++;
    }

    console.log(`Successfully migrated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
