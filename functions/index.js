import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Busboy from "busboy";

const intakeToken = defineSecret("INTAKE_TOKEN");

initializeApp();
const db = getFirestore();

export const jotformWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      logger.info(`UNEXPECTED_CONTENT_TYPE ${contentType}`);
      return res.status(400).send("Expected multipart/form-data");
    }

    const fields = {};

    await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });

      busboy.on("field", (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on("file", (fieldname, file) => {
        file.resume();
      });

      busboy.on("finish", resolve);
      busboy.on("error", reject);

      busboy.end(req.rawBody);
    });

    logger.info(`WEBHOOK_FIELDS ${JSON.stringify(Object.keys(fields))}`);

    const submissionId = fields.submissionID;
    if (!submissionId) {
      logger.error("Missing submissionID");
      return res.status(400).send("Missing submissionID");
    }

    let raw = {};
    try {
      raw = fields.rawRequest ? JSON.parse(fields.rawRequest) : {};
    } catch (err) {
      logger.error(`RAW_REQUEST_PARSE_FAILED ${err?.message || err}`);
      return res.status(400).send("Invalid rawRequest JSON");
    }

    const firstName = raw.q3_clientLegal?.first || "";
    const lastName = raw.q3_clientLegal?.last || "";
    const clientName = `${firstName} ${lastName}`.trim();

    const providerSnap = await db.collection("providers").get();
    const providerNames = providerSnap.docs.map((d) => d.id);

    const preferredProviders = Array.isArray(raw.q7_pleaseIndicate)
      ? raw.q7_pleaseIndicate.map((v) => matchProvider(v, providerNames)).join(", ")
      : matchProvider(raw.q7_pleaseIndicate, providerNames);

    const servicesRequested = Array.isArray(raw.q10_whatType)
      ? raw.q10_whatType.join(", ")
      : raw.q10_whatType || "";

    const promptedYou = Array.isArray(raw.q35_promptedYou)
      ? raw.q35_promptedYou.join(", ")
      : raw.q35_promptedYou || "";

    const tags = Array.isArray(raw.q34_whatProblems)
      ? raw.q34_whatProblems.join(", ")
      : raw.q34_whatProblems || "";

    const days = Array.isArray(raw.q41_daysAvailable)
      ? raw.q41_daysAvailable.join(", ")
      : raw.q41_daysAvailable || "";

    const dob = formatDateObject(raw.q18_clientDob);
    const insuredDob = formatDateObject(raw.q32_insuredsDob);

    const phone =
      raw.q16_clientguardianPhone?.full ||
      raw.q16_clientguardianPhone ||
      "";

    const doc = {
      source: "jotform",
      jotform: {
        submissionId: fields.submissionID || "",
        formId: fields.formID || "",
        username: fields.username || "",
        ip: fields.ip || "",
        pretty: fields.pretty || ""
      },
      intake: {
        submissionDate: raw.submitDate
          ? new Date(Number(raw.submitDate)).toISOString()
          : "",
        firstName,
        lastName,
        clientName,
        preferredName: raw.q14_preferredName || "",
        phone,
        email: raw.q17_clientguardianEmail || "",
        dob,
        insurance: raw.q24_insuranceProvider || "",
        memberId: raw.q28_memberId || "",
        relationship: raw.q45_relationshipTo || "",
        insuredName: raw.q30_insuredsName || "",
        insuredDob,
        preferredProvider: preferredProviders,
        servicesRequested,
        parentFirstName: raw.q15_parentguardianName?.first || "",
        parentLastName: raw.q15_parentguardianName?.last || "",
        tags: "",
        promptedYou,
        problemChecklist: tags,
        previousTherapy: raw.q36_haveYou || "",
        previousMeds: raw.q38_haveYou38 || "",
        safety: raw.q39_haveYou39 || "",
        days,
        times: raw.q40_availabilityFor || "",
        ipTele: raw.q43_inPerson || "",
        openToIntern: raw.q9_areYou || ""
      },
      pipeline: {
        status: "new",
        assignedProvider: "",
        lastContactDate: "",
        nextStep: "",
        contactAttempts: 0
      },
      createdAt: raw.submitDate
        ? new Date(Number(raw.submitDate))
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.collection("inquiries").doc(String(submissionId)).set(doc, {
      merge: true
    });

    logger.info(`INQUIRY_SAVED ${submissionId} ${clientName}`);
    return res.status(200).send("ok");
  } catch (err) {
    logger.error(`WEBHOOK_FAILED ${err?.message || err}`);
    return res.status(500).send("Webhook failed");
  }
});

// ── Google Sheets intake ──────────────────────────────────────────────────────

export const sheetIntake = onRequest({ secrets: [intakeToken], invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const token = req.headers["x-intake-token"];
  if (!token || token !== intakeToken.value()) {
    logger.warn("SHEET_INTAKE_UNAUTHORIZED");
    return res.status(401).send("Unauthorized");
  }

  try {
    const data = req.body;

    const clientName = (data.clientName || "").trim();
    if (!clientName) {
      return res.status(400).send("Missing clientName");
    }

    const nameParts = clientName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const parentName = (data.parentGuardianName || "").trim();
    const parentParts = parentName ? parentName.split(" ") : [];

    const responseId = data.responseId || `gs_${Date.now()}`;

    const doc = {
      source: "google_sheets",
      intake: {
        submissionDate: data.submittedAt || new Date().toISOString(),
        clientName,
        firstName,
        lastName,
        preferredName: data.preferredName || "",
        phone: data.phone || "",
        email: data.email || "",
        dob: data.dob || "",
        parentFirstName: parentParts[0] || "",
        parentLastName: parentParts.slice(1).join(" ") || "",
        insurance: data.insurance || "",
        memberId: data.memberId || "",
        preferredProvider: data.preferredProvider || "",
        openToIntern: data.openToIntern || "",
        servicesRequested: data.servicesRequested || "",
        problemChecklist: data.problemChecklist || "",
        promptedYou: data.promptedYou || "",
        previousTherapy: data.previousTherapy || "",
        previousMeds: data.previousMeds || "",
        safety: data.safety || "",
        days: data.days || "",
        times: data.times || "",
        ipTele: data.ipTele || "",
        referralSource: data.referralSource || "",
        tags: "",
      },
      pipeline: {
        status: "new",
        assignedProvider: "",
        lastContactDate: "",
        nextStep: "",
        contactAttempts: 0,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("inquiries").doc(responseId).set(doc, { merge: true });

    logger.info(`SHEET_INTAKE_SAVED ${responseId} ${clientName}`);
    return res.status(200).json({ ok: true, id: responseId });
  } catch (err) {
    logger.error(`SHEET_INTAKE_FAILED ${err?.message || err}`);
    return res.status(500).send("Intake failed");
  }
});

// ── Intranet post notifications ───────────────────────────────────────────────

const CATEGORY_LABELS = {
  general: "General",
  announcement: "Announcement",
  celebration: "Celebration",
  update: "Update",
};

export const onNewIntranetPost = onDocumentCreated("intranet_posts/{postId}", async (event) => {
  const post = event.data.data();
  const postId = event.params.postId;
  const { authorName, content, category, sendNotification } = post;

  // Only notify if the author explicitly opted in
  if (!sendNotification) {
    logger.info(`INTRANET_NOTIFY skipped for post ${postId} (sendNotification=false)`);
    return;
  }

  const categoryLabel = CATEGORY_LABELS[category] || category;
  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;

  // Get all Auth users to access their emails
  const listResult = await getAuth().listUsers();
  const recipients = listResult.users.filter((u) => u.email);

  // Get Firestore user docs to resolve providerName for in-app notifications
  const userDocs = await db.collection("users").get();
  const userDataMap = {};
  userDocs.forEach((d) => { userDataMap[d.id] = d.data(); });

  const writes = recipients.map((user) => {
    const providerName = userDataMap[user.uid]?.providerName;
    const ops = [];

    // In-app bell notification
    if (providerName) {
      ops.push(db.collection("notifications").add({
        recipientProviderName: providerName,
        type: "intranet_post",
        message: `${authorName} posted in ${categoryLabel}: "${preview}"`,
        relatedId: postId,
        createdByName: authorName,
        read: false,
        createdAt: new Date(),
      }));
    }

    // Email via Trigger Email extension (writes to `mail` collection)
    ops.push(db.collection("mail").add({
      to: user.email,
      message: {
        subject: `[MindfulWayOS] New ${categoryLabel} post from ${authorName}`,
        text: `${authorName} posted in ${categoryLabel}:\n\n${content}\n\n— MindfulWayOS Intranet`,
        html: buildPostEmailHtml({ authorName, categoryLabel, content }),
      },
    }));

    return ops;
  });

  await Promise.all(writes.flat());
  logger.info(`INTRANET_NOTIFY sent to ${recipients.length} users for post ${postId}`);
});

function buildPostEmailHtml({ authorName, categoryLabel, content }) {
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <div style="background:#7c3aed;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="color:#fff;font-weight:700;font-size:18px">MindfulWayOS Intranet</span>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${categoryLabel}</p>
        <p style="margin:0 0 16px 0;font-size:15px;font-weight:600">${authorName} posted a new update</p>
        <div style="background:#f9fafb;border-left:3px solid #7c3aed;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;line-height:1.6;color:#374151">${escaped}</div>
        <p style="margin:20px 0 0 0;font-size:12px;color:#9ca3af">Log in to MindfulWayOS to react or reply.</p>
      </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchProvider(raw, providerNames = []) {
  if (!raw) return "";
  // Strip parenthetical suffixes like " (Intern)" before matching
  const cleaned = raw.replace(/\s*\(.*?\)/g, "").trim();
  const lower = cleaned.toLowerCase();
  const match = providerNames.find(p => lower.includes(p.toLowerCase()));
  return match || raw;
}

function formatDateObject(value) {
  if (!value || typeof value !== "object") return "";
  const { month = "", day = "", year = "" } = value;
  if (!month || !day || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}