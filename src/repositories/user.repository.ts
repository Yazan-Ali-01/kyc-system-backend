import { IUser, User } from "@/models/user.model";
import { BadRequestError, NotFoundError } from "@/utils/errors/custom-errors";
import { FilterQuery } from "mongoose";

export class UserRepository {
  private static instance: UserRepository;

  private constructor() {}

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  public async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      const existingUser = await User.findByEmail(userData.email!);
      if (existingUser) {
        throw new BadRequestError("Email already exists");
      }

      const user = new User(userData);
      await user.save();
      return user;
    } catch (error) {
      throw error;
    }
  }

  public async findUserById(id: string): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  public async findUserByEmail(email: string): Promise<IUser | null> {
    return User.findByEmail(email);
  }

  public async updateUser(
    id: string,
    updateData: Partial<IUser>
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  public async incrementLoginAttempts(email: string): Promise<void> {
    const user = await User.findByEmail(email);
    if (user) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      await user.save();
    }
  }

  public async resetLoginAttempts(email: string): Promise<void> {
    await User.updateOne(
      { email },
      {
        $set: {
          loginAttempts: 0,
          lockUntil: null,
          lastLogin: new Date(),
        },
      }
    );
  }

  public async findUsers(query: FilterQuery<IUser>): Promise<IUser[]> {
    return User.find(query);
  }
}
