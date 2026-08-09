import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getPresignedGetUrl } from '../../../infrastructure/s3-client.js';
import { env } from '../../../config/env.js';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12 },
  header: { fontSize: 18, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  label: { width: 150, fontWeight: 'bold' },
  value: { flex: 1 },
});

export async function generatePrintableForm(input: {
  formType: 'complaint' | 'document-request';
  referenceCode: string;
  data: Record<string, unknown>;
}): Promise<string> {
  const FormDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>
          {input.formType === 'complaint' ? 'Citizen Complaint Form' : 'Document Request Form'}
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>Reference Code:</Text>
          <Text style={styles.value}>{input.referenceCode}</Text>
        </View>
        {Object.entries(input.data).map(([key, value]) => {
          if (value == null || value === '') return null;
          return (
            <View style={styles.row} key={key}>
              <Text style={styles.label}>{key}</Text>
              <Text style={styles.value}>{String(value)}</Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );

  const stream = await renderToStream(<FormDocument />);
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const key = `generated-forms/${input.referenceCode}.pdf`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET || 'batac-dms-assets',
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  });

  await getS3Client().send(command);

  // Return a 24-hour presigned URL (24 * 60 * 60 = 86400 seconds)
  return getPresignedGetUrl(key, 86400);
}
