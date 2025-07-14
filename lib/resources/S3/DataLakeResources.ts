import { Stack, Duration, RemovalPolicy, StackProps, CfnOutput, Aws, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';

config();

export class S3DataLakeResources extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly bucketFeatures: s3.Bucket;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucketName = process.env.BUCKETNAME_S3_LAKE || 'decision-data-lake';
    const bucketNameFeatures = process.env.BUCKETNAME_S3_LAKE_FEATURES || 'decision-data-lake-features';

    // Bucket para demais pastas (raw, processed, models, logs, drift_reports)
    const bucket = new s3.Bucket(this, 'DataLakeBucket', {
      versioned: false,
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.bucket = bucket;

    // Bucket específico para features com versionamento habilitado
    const bucketFeatures = new s3.Bucket(this, 'DataLakeBucketFeatures', {
      versioned: true,
      bucketName: bucketNameFeatures,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.bucketFeatures = bucketFeatures;

    // Adiciona regras de ciclo de vida para as pastas do bucket principal
    const folders = ['raw', 'processed', 'models', 'logs', 'drift_reports'];
    folders.forEach(folder => {
      bucket.addLifecycleRule({
        prefix: `${folder}/`,
        enabled: true,
        expiration: Duration.days(365), // Expiração em 365 dias
      });
    });

    // No bucket de features, consideramos que os arquivos serão carregados com o prefixo "features/"
    // Aplica um ciclo de vida para expirar versões não atuais após 10 dias
    bucketFeatures.addLifecycleRule({
      prefix: 'features/',
      enabled: true,
      noncurrentVersionExpiration: Duration.days(10),
    });

    // Permissões para upload de arquivos
    // Cria políticas separadas para cada bucket
    const bucketPolicyStatement = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });
    bucket.addToResourcePolicy(bucketPolicyStatement);

    const bucketFeaturesPolicyStatement = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${bucketFeatures.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });
    bucketFeatures.addToResourcePolicy(bucketFeaturesPolicyStatement);

    new CfnOutput(this, 'BucketNameOutput', {
      value: bucket.bucketName,
      description: 'The name of the S3 bucket for raw, processed, models, logs and drift_reports',
    });

    new CfnOutput(this, 'BucketFeaturesNameOutput', {
      value: bucketFeatures.bucketName,
      description: 'The name of the S3 bucket for features with versioning',
    });
  }
}