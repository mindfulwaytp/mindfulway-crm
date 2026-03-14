const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbynKe5GKkqUs-nKq9JRlBMJ0TrltZtrSrkt0f4z8QIUfMmdau14kkdct_3b-kK67YE/exec";

export async function onRequest(context) {
  try {
    const request = context.request;
    const url = new URL(request.url);

    if (request.method === "GET") {
      const action = url.searchParams.get("action") || "list";

      const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, {
        method: "GET",
      });

      const text = await response.text();

      return new Response(text, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (request.method === "POST") {
      const body = await request.text();

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body,
      });

      const text = await response.text();

      return new Response(text, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Function crashed",
        message: err.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
