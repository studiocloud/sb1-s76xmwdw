import { SMTPConnection } from 'smtp-connection';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  email: string;
  validation_result: string;
  validation_reason: string;
  [key: string]: string;
}

async function checkSMTPConnection(domain: string, email: string): Promise<boolean> {
  try {
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return false;
    }

    const connection = new SMTPConnection({
      host: mxRecords[0].exchange,
      port: 25,
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    });

    return new Promise((resolve) => {
      connection.connect(() => {
        connection.quit();
        resolve(true);
      });

      connection.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export async function validateEmail(email: string): Promise<ValidationResult> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      email,
      validation_result: 'Invalid',
      validation_reason: 'Invalid email format',
    };
  }

  const [, domain] = email.split('@');

  try {
    const hasMXRecord = await checkSMTPConnection(domain, email);
    
    if (!hasMXRecord) {
      return {
        email,
        validation_result: 'Invalid',
        validation_reason: 'Domain does not have valid mail servers',
      };
    }

    return {
      email,
      validation_result: 'Valid',
      validation_reason: 'Email format and mail server verified',
    };
  } catch (error) {
    return {
      email,
      validation_result: 'Invalid',
      validation_reason: 'Unable to verify mail server',
    };
  }
}

export async function validateEmailBulk(emails: any[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const row of emails) {
    const result = await validateEmail(row.email);
    results.push({
      ...row,
      validation_result: result.validation_result,
      validation_reason: result.validation_reason,
    });
  }

  return results;
}