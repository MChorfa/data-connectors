import axios from "axios";
import fs from "fs";
import { createReadStream } from "node:fs";
import FormData from "form-data";
import dotenv from "dotenv";
import pdf from "pdf-parse";

dotenv.config();

async function processPdf(file){
    const fileContent = fs.readFileSync(file);
    const data = await pdf(fileContent);
    return data.text;
  }
export async function processPdfToText(filePath: string): Promise<string> {
  let content = "";

  if (process.env.LLAMAPARSE_API_KEY) {
    const apiKey = process.env.LLAMAPARSE_API_KEY;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };
    const base_url = "https://api.cloud.llamaindex.ai/api/parsing";
    const fileType2 = "application/pdf";

    try {
      const formData = new FormData();
      formData.append("file", createReadStream(filePath), {
        filename: filePath,
        contentType: fileType2,
      });

      const uploadUrl = `${base_url}/upload`;
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          ...headers,
          ...formData.getHeaders(),
        },
      });

      const jobId = uploadResponse.data.id;
      const resultType = "text";
      const resultUrl = `${base_url}/job/${jobId}/result/${resultType}`;

      let resultResponse;
      let attempt = 0;
      const maxAttempts = 10; // Maximum number of attempts
      let resultAvailable = false;

      while (attempt < maxAttempts && !resultAvailable) {
        try {
          resultResponse = await axios.get(resultUrl, { headers });
          if (resultResponse.status === 200) {
            resultAvailable = true; // Exit condition met
          } else {
            // If the status code is not 200, increment the attempt counter and wait
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 2 seconds
          }
        } catch (error) {
          console.error("Error fetching result:", error);
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 2 seconds before retrying
          // You may want to handle specific errors differently
        }
      }

      if (!resultAvailable) {
        content = await processPdf(filePath);
      }
      content = resultResponse.data[resultType];
    } catch (error) {
      console.error("Error processing document:", filePath, error);
      content = await processPdf(filePath);
    }
  } else {
    content = await processPdf(filePath);
  }
  return content;
}
