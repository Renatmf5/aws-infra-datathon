import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { FastApiEcsStack } from '../resources/Ecs/FastApiEcsStack';
import { FastApiPipelineStack } from '../resources/Pipelines/FastApiPipelineStack';
import { ApplicationLoadBalancer, ApplicationProtocol, ApplicationTargetGroup, ListenerAction, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { FastApiALBResources } from '../resources/ALB_ACM/FastApiALBResources';

import { ACMResources } from '../resources/ALB_ACM/AcmResources';

import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpAlbIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export interface FastApiStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  bucket: s3.IBucket;

}

export class FastApiStack extends cdk.Stack {
  public readonly fastApiEcs: FastApiEcsStack;
  public readonly fastApiAlbResources: FastApiALBResources;

  constructor(scope: Construct, id: string, props: FastApiStackProps) {
    super(scope, id, props);

    // Instancia a stack de serviço FastAPI, reutilizando vpc e bucket.
    const fastApiEcs = new FastApiEcsStack(this, 'FastApiEcsStack', {
      vpc: props.vpc,
      bucketArn: props.bucket,
      env: props.env,
    });

    // Instancia a stack de pipeline FastAPI, reutilizando o repositório do serviço.
    const fastApiPipeline = new FastApiPipelineStack(this, 'FastApiPipelineStack', {
      env: props.env,
      ecsService: fastApiEcs.ecsService,
      repository: fastApiEcs.repository,
    });

    // Define dependência: Pipeline só será criado após a ECS estar disponível
    fastApiPipeline.addDependency(fastApiEcs);

    // ------------------------
    // Configuração do ALB com SSL/ACM para Fargate
    // ------------------------

    // Instancia o construct que cria o certificado (ACM)
    const acmResources = new ACMResources(this, 'AcmResources');
    const certificate = acmResources.apiCertificate;

    const albResources = new FastApiALBResources(this, 'FastApiALBResources', {
      vpc: props.vpc,
      certificate: certificate,
    });
    this.fastApiAlbResources = albResources;


    // Anexa o serviço ECS ao Target Group, informando o nome do container e a porta
    fastApiEcs.ecsService.attachToApplicationTargetGroup(albResources.targetGroup);


    // ------------------------
    // Configuração do API Gateway integrado ao ALB

    // Crie um VpcLink usando as subredes públicas da VPC
    const vpcLink = new apigw.VpcLink(this, 'FastApiVpcLink', {
      vpc: props.vpc,
      vpcLinkName: 'FastApiVpcLink',
      subnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
    });

    // ------------------------

    // Cria um HTTP API do API Gateway
    const httpApi = new apigw.HttpApi(this, 'FastApiHttpApi', {
      createDefaultStage: true,
    });


    // Integra o API Gateway com o ALB usando o VPC Link configurado
    const albIntegration = new HttpAlbIntegration('AlbIntegration', albResources.httpsListener, {
      vpcLink: vpcLink,
    });

    // Define as rotas do API Gateway apontando para o ALB
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigw.HttpMethod.ANY],
      integration: albIntegration,
    });

    // Adiciona dependência: API Gateway só será criado após o ALB estar estabelecido
    httpApi.node.addDependency(albResources);
  }
}