const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  const formData = new FormData();
  // We use the dummy valid PDF already in the test data folder
  const fileStream = fs.createReadStream('./node_modules/pdf-parse/test/data/01-valid.pdf');
  formData.append('file', fileStream, 'test.pdf');

  try {
    const res = await axios.post('https://risk-shield-mvp.vercel.app/api/upload', formData, {
      headers: formData.getHeaders(),
    });
    console.log("Response:", res.data);
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

testUpload();
