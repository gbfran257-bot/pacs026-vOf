const sharp = require('sharp');
const dcmjs = require('dcmjs');

const { DicomMetaDictionary, DicomDict } = dcmjs.data;

function pad2(n) { return n.toString().padStart(2, '0'); }

function todayAsDicomDate() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

async function imageToDicomBuffer({ imageBuffer, patientName, patientId, studyDescription, modality, studyInstanceUID, seriesInstanceUID, sopInstanceUID }) {
  // Normaliza cualquier formato (png, jpg, webp...) a RGB crudo de 8 bits
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const meta = {
    MediaStorageSOPClassUID: '1.2.840.10008.5.1.4.1.1.7', // Secondary Capture
    MediaStorageSOPInstanceUID: sopInstanceUID,
    TransferSyntaxUID: '1.2.840.10008.1.2.1', // Explicit VR Little Endian
    ImplementationClassUID: DicomMetaDictionary.uid(),
    ImplementationVersionName: 'PACS_PORTAL_1_0',
  };

  const dataset = {
    PatientName: patientName.replace(/\s+/g, '^'),
    PatientID: patientId,
    StudyInstanceUID: studyInstanceUID,
    SeriesInstanceUID: seriesInstanceUID,
    SOPInstanceUID: sopInstanceUID,
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
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

  const denaturalized = DicomMetaDictionary.denaturalizeDataset(dataset);
  const dicomDict = new DicomDict(meta);
  dicomDict.dict = denaturalized;

  return Buffer.from(dicomDict.write());
}

function isDicomBuffer(buffer) {
  if (buffer.length < 132) return false;
  return buffer.toString('ascii', 128, 132) === 'DICM';
}

function overrideDicomFields(buffer, overrides) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer, { ignoreErrors: true });
  const dataset = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);

  if (overrides.studyInstanceUID) dataset.StudyInstanceUID = overrides.studyInstanceUID;
  if (overrides.seriesInstanceUID) dataset.SeriesInstanceUID = overrides.seriesInstanceUID;
  if (overrides.patientName) dataset.PatientName = overrides.patientName.replace(/\s+/g, '^');
  if (overrides.patientId) dataset.PatientID = overrides.patientId;

  // SIEMPRE un SOPInstanceUID nuevo: estamos reasignando el archivo a otro
  // paciente/estudio, así que ya no puede conservar la identidad original
  // (si la conserva, dcm4chee-arc lo rechaza como instancia duplicada si
  // ese archivo ya se subió antes por cualquier otra vía).
  dataset.SOPInstanceUID = overrides.sopInstanceUID;

  const denaturalized = DicomMetaDictionary.denaturalizeDataset(dataset);
  dicomDict.dict = denaturalized;
  dicomDict.meta.MediaStorageSOPInstanceUID = dataset.SOPInstanceUID;

  return {
    buffer: Buffer.from(dicomDict.write()),
    sopInstanceUID: dataset.SOPInstanceUID,
    patientName: dataset.PatientName,
    patientId: dataset.PatientID,
    modality: dataset.Modality,
  };
}

function readDicomMetadataPreview(buffer) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer, { ignoreErrors: true });
  const dataset = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);
  return {
    patientName: (dataset.PatientName || '').replace(/\^/g, ' ').trim(),
    patientId: dataset.PatientID || '',
    studyDate: dataset.StudyDate || '',
    studyDescription: dataset.StudyDescription || '',
    modality: dataset.Modality || '',
  };
}

module.exports = {
  imageToDicomBuffer,
  isDicomBuffer,
  overrideDicomFields,
  readDicomMetadataPreview,
};
