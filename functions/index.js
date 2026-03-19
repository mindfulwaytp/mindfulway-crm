import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Busboy from "busboy";

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

    const preferredProviders = Array.isArray(raw.q7_pleaseIndicate)
      ? raw.q7_pleaseIndicate.join(", ")
      : raw.q7_pleaseIndicate || "";

    const servicesRequested = Array.isArray(raw.q10_whatType)
      ? raw.q10_whatType.join(", ")
      : raw.q10_whatType || "";

    const promptedYou = Array.isArray(raw.q35_promptedYou)
      ? raw.q35_promptedYou.join(", ")
      : raw.q35_promptedYou || "";

    const problemChecklist = Array.isArray(raw.q34_whatProblems)
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
        problemChecklist,
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

function formatDateObject(value) {
  if (!value || typeof value !== "object") return "";
  const { month = "", day = "", year = "" } = value;
  if (!month || !day || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}