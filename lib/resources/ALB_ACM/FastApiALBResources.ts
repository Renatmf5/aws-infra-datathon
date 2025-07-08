import { Construct } from 'constructs';
import { Instance, SecurityGroup, Peer, Port } from 'aws-cdk-lib/aws-ec2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ApplicationProtocol, ApplicationTargetGroup, ListenerAction, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

interface ALBProps {
  vpc: ec2.IVpc;
  certificate: Certificate;
}

export class FastApiALBResources extends Construct {
  public readonly alb: ApplicationLoadBalancer;  // Expondo o ALB publicamente
  public readonly targetGroup: ApplicationTargetGroup; // Expondo o Target Group publicamente
  public readonly httpsListener: ApplicationListener; // Listener HTTPS, se necessário

  constructor(scope: Construct, id: string, props: ALBProps) {
    super(scope, id);

    const albSecurityGroup = new SecurityGroup(this, 'fastapi-ALBSecurityGroup', {
      vpc: props.vpc,

      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic');
    albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS traffic');

    this.alb = new ApplicationLoadBalancer(this, 'FastApiALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // EC2 Target Group

    const targetGroup = new ApplicationTargetGroup(this, 'FastApiTargetGroup', {
      vpc: props.vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 80,
      targetType: TargetType.IP,
    });
    this.targetGroup = targetGroup;


    const httpsListener = this.alb.addListener('FastApiListener', {
      port: 443,
      certificates: [props.certificate],
      defaultAction: ListenerAction.forward([targetGroup]),
    });
    this.httpsListener = httpsListener;

    // Adicionar um listener HTTP para redirecionar para HTTPS
    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      defaultAction: ListenerAction.redirect({
        protocol: ApplicationProtocol.HTTPS,
        port: '443',
        permanent: true,
      }),
    });
  }
}