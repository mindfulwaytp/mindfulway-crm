import fs from "fs";
import csv from "csv-parser";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOLtG1Z-WMuhpYZomhFZ1TlOXAwKL857c",
  authDomain: "mwcrm-5970d.firebaseapp.com",
  projectId: "mwcrm-5970d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function parseSubmissionDate(value) {
  if (!value) return new Date();

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

fs.createReadStream("inquiries.csv")
.pipe(csv())
.on("data", async (row) => {

  const clientName = `${row["First Name"]} ${row["Last Name"]}`.trim();

  await addDoc(collection(db,"inquiries"),{

    source: "sheet-import",

    intake: {
      submissionDate: row["Submission Date"],
      firstName: row["First Name"],
      lastName: row["Last Name"],
      clientName: clientName,
      preferredName: row["Chosen Name"],
      phone: row["Phone"],
      email: row["Email"],
      dob: row["Client DOB"],
      insurance: row["Ins. Comp."],
      memberId: row["Member ID"],
      relationship: row["Relationship"],
      insuredName: row["Insured Name"],
      insuredDob: row["Insured DOB"],
      preferredProvider: row["Pref. Provider"],
      servicesRequested: row["Services"],
      parentFirstName: row["Parent First Name"],
      parentLastName: row["Parent Last Name"],
      problemChecklist: row["Tags"],
      promptedYou: row["Reason for Therapy"],
      previousTherapy: row["Prev. Therapy"],
      previousMeds: row["Prev. Meds"],
      safety: row["Safety"],
      days: row["Days"],
      times: row["Times"],
      ipTele: row["IP/Tele"],
      openToIntern: row["Open to working with intern"]
    },

    pipeline: {
      status: row["Status"] || "new",
      assignedProvider: "",
      contactAttempts: 0,
      archived: false
    },

    createdAt: parseSubmissionDate(row["Submission Date"]),
    updatedAt: new Date(),
  });

  console.log("Imported:", clientName)

})
.on("end",()=>{

  console.log("Import complete")

})