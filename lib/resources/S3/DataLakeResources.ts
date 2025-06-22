import { Stack, Duration, RemovalPolicy, StackProps, CfnOutput, Aws, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';

config();

export class S3DataLakeResources extends Stack {
  public readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id);

    const bucketName = process.env.BUCKETNAME_S3_LAKE || 'decision-data-lake';

    const bucket = new s3.Bucket(this, 'DataLakeBucket', {
      versioned: false,
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.bucket = bucket;


    // Adiciona as pastas Row, processed, feaatures, models, logs e drift_reports
    const folders = ['raw', 'processed', 'features', 'models', 'logs', 'drift_reports'];
    folders.forEach(folder => {
      bucket.addLifecycleRule({
        prefix: `${folder}/`,
        enabled: true,
        expiration: Duration.days(365), // Expiração em 365 dias
      });
    });

    // Permissões para upload de arquivos
    const bucketPolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });

    bucket.addToResourcePolicy(bucketPolicy);

    new CfnOutput(this, 'BucketNameOutput', {
      value: bucket.bucketName,
      description: 'The name of the S3 bucket',
    });
  }
}