const sharp = require('sharp');
const dcmjs = require('dcmjs');

const { DicomMetaDictionary, DicomDict, DicomMessage } = dcmjs.data;

const SC_CLASS = '1.2.840.10008.5.1.4.1.1.7'; // Secondary Capture

function pad2(n) { return n.toString().padStart(2, '0'); }

function todayAsDicomDate() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

async function imageToDicomBuffer({ imageBuffer, patientName, patientId, studyDescription, modality, studyInstanceUID, seriesInstanceUID, sopInstanceUID }) {
  // Normaliza cualquier formato (png, jpg, webp...) a RGB crudo de 8 bits
  const { data, info } = await sharp(imageBuffer)
    .rotate() // respeta orientación EXIF
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  // El meta va con tags hexadecimales (dcmjs no acepta nombres aquí)
  const meta = {
    '00020002': { vr: 'UI', Value: [SC_CLASS] },
    '00020003': { vr: 'UI', Value: [sopInstanceUID] },
    '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] }, // Explicit VR Little Endian
    '00020012': { vr: 'UI', Value: [DicomMetaDictionary.uid()] },
    '00020013': { vr: 'SH', Value: ['PACS_PORTAL_1_0'] },
  };

  const dataset = {
    PatientName: patientName.trim().replace(/\s+/g, '^'),
    PatientID: patientId,
    StudyInstanceUID: studyInstanceUID,
    SeriesInstanceUID: seriesInstanceUID,
    SOPInstanceUID: sopInstanceUID,
    SOPClassUID: SC_CLASS,
    Modality: modality || 'OT',
    StudyDate: todayAsDicomDate(),
    SeriesDate: todayAsDicomDate(),
    ContentDate: todayAsDicomDate(),
    StudyDescription: studyDescription || '',
    SeriesNumber: '1',
    InstanceNumber: '1',
    Rows: info.height,
    Columns: info.width,
    SamplesPerPixel: 3,
    PhotometricInterpretation: 'RGB',
    PlanarConfiguration: 0,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    PixelData: [data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)],
  };

  const dicomDict = new DicomDict(meta);
  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);

  return Buffer.from(dicomDict.write());
}

function isDicomBuffer(buffer) {
  if (buffer.length < 132) return false;
  return buffer.toString('ascii', 128, 132) === 'DICM';
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function pnToString(pn) {
  if (pn && typeof pn === 'object') pn = pn.Alphabetic;
  return String(pn || '').replace(/\^/g, ' ').trim();
}

// Lee el StudyInstanceUID de un DICOM sin modificarlo (null si no se puede)
function readStudyUid(buffer) {
  try {
    const dd = DicomMessage.readFile(toArrayBuffer(buffer), { ignoreErrors: true });
    const v = dd.dict['0020000D'] && dd.dict['0020000D'].Value && dd.dict['0020000D'].Value[0];
    return v || null;
  } catch (e) {
    return null;
  }
}

function readDicomMetadataPreview(buffer) {
  const dd = DicomMessage.readFile(toArrayBuffer(buffer), { ignoreErrors: true });
  const dataset = DicomMetaDictionary.naturalizeDataset(dd.dict);
  return {
    patientName: pnToString(dataset.PatientName),
    patientId: dataset.PatientID || '',
    studyDate: dataset.StudyDate || '',
    studyDescription: dataset.StudyDescription || '',
    modality: dataset.Modality || '',
  };
}

module.exports = {
  imageToDicomBuffer,
  isDicomBuffer,
  readStudyUid,
  readDicomMetadataPreview,
};
