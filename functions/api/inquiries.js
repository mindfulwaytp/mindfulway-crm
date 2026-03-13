const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/YAKfycbynKe5GKkqUs-nKq9JRlBMJ0TrltZtrSrkt0f4z8QIUfMmdau14kkdct_3b-kK67YE/exec";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  const action = url.searchParams.get("action");

  const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`);

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
