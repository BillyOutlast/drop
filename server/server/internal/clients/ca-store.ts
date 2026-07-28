import type { CertificateBundle } from "./ca";
import prisma from "../db/database";

export type CertificateStore = {
  store(name: string, data: CertificateBundle): Promise<void>;
  fetch(name: string): Promise<CertificateBundle | undefined>;
  blacklistCertificate(name: string): Promise<void>;
  checkBlacklistCertificate(name: string): Promise<boolean>;
};

export const dbCertificateStore = () => {
  const store: CertificateStore = {
    async store(name: string, data: CertificateBundle) {
      await prisma.certificate.upsert({
        where: {
          id: name,
        },
        create: {
          id: name,
          privateKey: data.priv,
          certificate: data.cert,
        },
        update: {
          privateKey: data.priv,
          certificate: data.cert,
        },
      });
    },
    async fetch(name: string) {
      const result = await prisma.certificate.findUnique({
        where: {
          id: name,
        },
        select: {
          privateKey: true,
          certificate: true,
        },
      });
      if (result === null) return undefined;
      return {
        priv: result.privateKey,
        cert: result.certificate,
      };
    },
    async blacklistCertificate(name: string) {
      await prisma.certificate.updateMany({
        where: {
          id: name,
        },
        data: {
          blacklisted: true,
        },
      });
    },
    async checkBlacklistCertificate(name: string): Promise<boolean> {
      const result = await prisma.certificate.findUnique({
        where: {
          id: name,
        },
        select: {
          blacklisted: true,
        },
      });
      if (result === null) return false;
      return result.blacklisted;
    },
  };
  return store;
};
