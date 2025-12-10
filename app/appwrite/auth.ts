import { ID, OAuthProvider, Query } from "appwrite";
import { account, database, appwriteConfig } from "~/appwrite/client";
import { redirect } from "react-router";

// -----------------------------
// Utility: Get existing user from DB
// -----------------------------
export const getExistingUser = async (id: string) => {
  try {
    const { documents, total } = await database.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", id)]
    );
    return total > 0 ? documents[0] : null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
};

// -----------------------------
// Utility: Fetch Google profile picture
// -----------------------------
const getGooglePicture = async (accessToken: string) => {
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=photos",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) throw new Error("Failed to fetch Google profile picture");

    const data = await res.json();
    return data.photos?.[0]?.url ?? null;
  } catch (err) {
    console.error("Error fetching Google picture:", err);
    return null;
  }
};

// -----------------------------
// Create or store user in DB
// -----------------------------
export const storeUserData = async () => {
  try {
    let user;
    try {
      user = await account.get();
    } catch (err: any) {
      if (err.code === 401) {
        redirect("/sign-in"); // user not logged in
        return;
      }
      throw err;
    }

    // Get OAuth access token if exists
    const session = await account.getSession("current").catch(() => null);
    const providerAccessToken = session?.providerAccessToken ?? null;

    const profilePicture = providerAccessToken
      ? await getGooglePicture(providerAccessToken)
      : null;

    // Check if user already exists
    const existingUser = await getExistingUser(user.$id);
    if (existingUser) return existingUser;

    // Create new user document
    const createdUser = await database.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      {
        accountId: user.$id,
        email: user.email,
        name: user.name,
        imageUrl: profilePicture,
        joinedAt: new Date().toISOString(),
      }
    );

    return createdUser;
  } catch (err) {
    console.error("Error storing user data:", err);
    return null;
  }
};

// -----------------------------
// Login with Google OAuth
// -----------------------------
export const loginWithGoogle = async () => {
  try {
    // Use window.location.origin for both localhost and production
    const origin = window.location.origin;

    account.createOAuth2Session(
      OAuthProvider.Google,
      `${origin}/`, // redirect on success
      `${origin}/404` // redirect on failure
    );
  } catch (err) {
    console.error("Error creating OAuth2 session:", err);
  }
};

// -----------------------------
// Logout current user
// -----------------------------
export const logoutUser = async () => {
  try {
    await account.deleteSession("current");
  } catch (err) {
    console.error("Error during logout:", err);
  }
};

// -----------------------------
// Get current logged-in user
// -----------------------------
export const getUser = async () => {
  try {
    let user;
    try {
      user = await account.get();
    } catch (err: any) {
      if (err.code === 401) {
        redirect("/sign-in"); // session expired or not logged in
        return null;
      }
      throw err;
    }

    const { documents } = await database.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [
        Query.equal("accountId", user.$id),
        Query.select(["name", "email", "imageUrl", "joinedAt", "accountId"]),
      ]
    );

    return documents.length > 0 ? documents[0] : null;
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
};

// -----------------------------
// Get all users with pagination
// -----------------------------
export const getAllUsers = async (limit: number, offset: number) => {
  try {
    const { documents: users, total } = await database.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.limit(limit), Query.offset(offset)]
    );

    return { users, total };
  } catch (err) {
    console.error("Error fetching users:", err);
    return { users: [], total: 0 };
  }
};
