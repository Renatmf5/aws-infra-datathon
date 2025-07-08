import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

export class ParameterStoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Criar os parâmetros
    new ssm.StringParameter(this, "DatabaseUrl", {
      parameterName: "/my-fastApi-app/DATABASE_URL",
      stringValue: process.env.DATABASE_URL || "default_database_url"
    });
    new ssm.StringParameter(this, "SystemDatabaseUrl", {
      parameterName: "/my-fastApi-app/SYSTEM_DATABASE_URL",
      stringValue: process.env.SYSTEM_DATABASE_URL || "default_database_url"
    });
    new ssm.StringParameter(this, "JwtSecret", {
      parameterName: "/my-fastApi-app/JWT_SECRET",
      stringValue: process.env.JWT_SECRET || "default_jwt_secret"
    });
    new ssm.StringParameter(this, "BucketName", {
      parameterName: "/my-fastApi-app/BUCKET_NAME",
      stringValue: process.env.BUCKETNAME_S3 || "default_bucket_name"
    });
    new ssm.StringParameter(this, "Env", {
      parameterName: "/my-fastApi-app/ENV",
      stringValue: process.env.ENV || "default_env"
    });
  }
}