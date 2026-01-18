import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

/**
 * Verify that the user is authenticated and has paid access
 * @returns {Promise<{ user: any, session: any } | { error: string, status: number }>}
 */
export async function verifyUserAccess() {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      error: "Unauthorized - Please sign in",
      status: 401,
    };
  }

  await connectMongo();
  const user = await User.findOne({ email: session.user.email });

  if (!user) {
    return {
      error: "User not found",
      status: 404,
    };
  }

  if (!user.hasAccess) {
    return {
      error: "Access denied - Please subscribe to access this feature",
      status: 403,
    };
  }

  return { user, session };
}

/**
 * Verify that the user is authenticated (but doesn't need paid access)
 * @returns {Promise<{ user: any, session: any } | { error: string, status: number }>}
 */
export async function verifyUserSession() {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      error: "Unauthorized - Please sign in",
      status: 401,
    };
  }

  await connectMongo();
  const user = await User.findOne({ email: session.user.email });

  if (!user) {
    // Create user if they don't exist
    const newUser = await User.create({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });
    return { user: newUser, session };
  }

  return { user, session };
}

