import { Construct } from 'constructs';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

export class ACMResources extends Construct {
  public apiCertificate: Certificate;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Buscar a Public Hosted Zone
    const publicHostedZone = route53.HostedZone.fromLookup(this, 'PublicHostedZone', {
      domainName: process.env.DOMINIO || 'grupo-ever-rmf.com',
      privateZone: false,
    });

    // Certificado para a API (FastAPI) - Private Hosted Zone
    this.apiCertificate = new Certificate(this, 'ApiCertificate', {
      domainName: process.env.API_SUBDOMINIO || 'api.grupo-ever-rmf.com',
      validation: CertificateValidation.fromDns(publicHostedZone),
    });


  }
}