import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import {
  getGmailClient,
  refreshAccessToken,
  searchVintedEmails,
  getEmailDetails,
} from "@/libs/gmail-api";
import { calculateWeeklySummary } from "@/libs/gmail-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("🔐 Getting session...");
    // Get current session
    const session = await auth();
    console.log("🔐 Session:", {
      hasUser: !!session?.user,
      hasAccessToken: !!session?.accessToken,
      hasRefreshToken: !!session?.refreshToken,
      userEmail: session?.user?.email,
    });

    if (!session?.user) {
      console.log("❌ No session user found");
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // Check if user has access token
    if (!session.accessToken) {
      console.log("❌ No access token found in session");
      console.log("💡 User needs to sign in with Google and grant Gmail permissions");
      return NextResponse.json(
        {
          error:
            "No Gmail access token found. Please sign in with Google and grant Gmail permissions.",
        },
        { status: 400 } // Use 400 instead of 403 to avoid "Pick a plan" error
      );
    }

    console.log("✅ Access token found, proceeding with Gmail API call");

    let accessToken = session.accessToken;

    // Check if token is expired and refresh if needed
    if (session.accessTokenExpires && Date.now() >= session.accessTokenExpires) {
      if (!session.refreshToken) {
        return NextResponse.json(
          {
            error:
              "Access token expired and no refresh token available. Please sign in again.",
          },
          { status: 403 }
        );
      }

      try {
        accessToken = await refreshAccessToken(session.refreshToken);
      } catch (error) {
        console.error("Error refreshing token:", error);
        return NextResponse.json(
          {
            error:
              "Failed to refresh access token. Please sign in again with Google.",
          },
          { status: 400 } // Use 400 instead of 403 to avoid "Pick a plan" error
        );
      }
    }

    // Get Gmail client
    const gmail = getGmailClient(accessToken);

    // Search for Vinted emails
    console.log("🔍 Searching for Vinted emails...");
    const messageIds = await searchVintedEmails(
      gmail,
      'from:no-reply@vinted.es "Transferencia a tu saldo Vinted"'
    );

    console.log("📬 Found message IDs:", messageIds);

    if (messageIds.length === 0) {
      console.log("⚠️ No Vinted emails found");
      return NextResponse.json({
        total: 0,
        count: 0,
        weeklyTotal: 0,
        weeklyCount: 0,
        details: [],
      });
    }

    // Get details for each email
    const emailDetailsPromises = messageIds.map((messageId) =>
      getEmailDetails(gmail, messageId)
    );

    const emailDetailsResults = await Promise.all(emailDetailsPromises);

    // Filter out null results (emails that couldn't be parsed)
    const emailDetails = emailDetailsResults.filter(
      (detail): detail is NonNullable<typeof detail> => detail !== null
    );

    // Calculate weekly summary
    const summary = calculateWeeklySummary(emailDetails);

    console.log("📧 Message IDs found:", messageIds.length);
    console.log("📧 Email details parsed:", emailDetails.length);
    console.log("📊 Summary calculated:", {
      total: summary.total,
      count: summary.count,
      weeklyTotal: summary.weeklyTotal,
      weeklyCount: summary.weeklyCount,
      detailsLength: summary.details.length,
    });

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Gmail API error:", error);

    // Handle specific Gmail API errors
    if (error.code === 401 || error.response?.status === 401) {
      return NextResponse.json(
        {
          error:
            "Gmail access token expired or invalid. Please sign in again with Google.",
        },
        { status: 401 }
      );
    }

    if (error.code === 403 || error.response?.status === 403) {
      return NextResponse.json(
        {
          error:
            "Gmail permissions denied. Please grant Gmail read permissions when signing in.",
        },
        { status: 400 } // Use 400 instead of 403 to avoid "Pick a plan" error
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to fetch Gmail data",
      },
      { status: 500 }
    );
  }
}

