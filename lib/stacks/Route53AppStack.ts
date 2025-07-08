import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';  // Import necessário para apontar para o ALB
import * as dotenv from 'dotenv';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';  // Import do ALB

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

interface Route53StackProps extends cdk.StackProps {
  fastApiLoadBalancer: ApplicationLoadBalancer;  // ALB para FastAPI
  //NextJsLoadBalancer: ApplicationLoadBalancer;  // ALB para Elastic NextJs
}

export class Route53Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: process.env.DOMINIO || "default_domain",
    });

    // Registro A para apontar para o ALB da FastAPI
    new route53.ARecord(this, "FastApiAliasRecord", {
      zone: hostedZone,
      recordName: "api",  // Cria o subdomínio api.grupo-ever-rmf.com
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(props.fastApiLoadBalancer)),  // Aponta para o ALB da FastAPI
    });

    /*
    // Registro A para apontar para o ALB do Elastic NextJs
    new route53.ARecord(this, "NextJsAliasRecord", {
      zone: hostedZone,
      recordName: "app",  // Cria o subdomínio app.grupo-ever-rmf.com
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(props.NextJsLoadBalancer)),  // Aponta para o ALB do Elastic NextJs
    });
    */
  }
}