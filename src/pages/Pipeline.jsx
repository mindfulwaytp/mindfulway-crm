import { useEffect, useState } from "react";
import { fetchInquiries } from "../lib/inquiriesApi";

function Pipeline() {

  const [inquiries, setInquiries] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await fetchInquiries();
      setInquiries(data);
    }

    load();
  }, []);

  return (
    <div>
      <h1>Inquiry Pipeline</h1>

      {inquiries.map((inq) => (
        <div key={inq.id}>
          {inq.name} — {inq.status}
        </div>
      ))}
    </div>
  );
}

export default Pipeline;
