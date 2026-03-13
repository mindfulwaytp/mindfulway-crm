const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbynKe5GKkqUs-nKq9JRlBMJ0TrltZtrSrkt0f4z8QIUfMmdau14kkdct_3b-kK67YE/exec";

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const action = url.searchParams.get("action");

    const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`);

    const data = await response.text();

    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Function crashed",
        message: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
