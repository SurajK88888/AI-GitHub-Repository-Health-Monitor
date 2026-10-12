import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get("installation_id");
    // const setupAction = searchParams.get("setup_action");

    // Redirect back to the repositories dashboard
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const redirectUrl = new URL("/repositories", baseUrl);

    if (installationId) {
        redirectUrl.searchParams.set("installed", "true");
    }

    return NextResponse.redirect(redirectUrl);
}