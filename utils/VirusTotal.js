const axios = require('axios');
const fs = require('fs');

// Remplacer par votre clé API VirusTotal
const API_KEY = '';

// Fonction pour analyser un fichier avec VirusTotal
async function scanFileWithVirusTotal(filePath) {
  const url = 'https://www.virustotal.com/vtapi/v2/file/scan';
  const fileData = fs.createReadStream(filePath);

  try {
    const response = await axios.post(url, {
      headers: {
        'x-apikey': API_KEY,
        'Content-Type': 'multipart/form-data'
      },
      data: fileData
    });

    return response.data; // Retourne les résultats de l'analyse
  } catch (error) {
    console.error('Erreur lors de la connexion à VirusTotal:', error);
    throw error;
  }
}

module.exports = scanFileWithVirusTotal;
