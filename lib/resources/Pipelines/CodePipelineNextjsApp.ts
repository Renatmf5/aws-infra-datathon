import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from "constructs";
import { ServerApplication, ServerDeploymentGroup, InstanceTagSet } from 'aws-cdk-lib/aws-codedeploy';
import { Pipeline, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubSourceAction, CodeDeployServerDeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";


export class CICDNextJsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    // Definindo artefatos do pipeline
    const sourceArtifact = new Artifact();

    // Definindo a ação de origem do GitHub
    const sourceAction = new GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: process.env.GITHUB_USERNAME || ' ',
      repo: process.env.REPOSITORY_NEXT_WEBAPP || ' ',
      branch: 'main', // ou a branch que deseja monitorar
      oauthToken: cdk.SecretValue.secretsManager('github/ingest-data-token', {
        jsonField: 'github_token', // Campo chave dentro do segredo onde o token está armazenado
      }),
      output: sourceArtifact,
    });

    // Definindo a aplicação e grupo de deployment do CodeDeploy
    const application = new ServerApplication(this, 'NextJsApplication', {
      applicationName: 'NextJsApp',
    });

    const deploymentGroup = new ServerDeploymentGroup(this, 'MyDeploymentGroup', {
      application: application,
      deploymentGroupName: 'MyNextJsDeploymentGroup',
      ec2InstanceTags: new InstanceTagSet({
        'Grupo': ['NextJsServer'], // Referencia as tags da instância EC2
      }),
    });

    const deployStage = {
      stageName: 'Deploy',
      actions: [
        new CodeDeployServerDeployAction({
          actionName: 'CodeDeploy',
          input: sourceArtifact,
          deploymentGroup: deploymentGroup, // Referencia o grupo de deploy criado
        }),
      ],
    };

    // Criando o pipeline e integrando os estágios
    const pipeline = new Pipeline(this, 'MyPipeline', {
      pipelineName: 'MyNextJsPipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        deployStage,
      ],
    });

    // Permissões do Pipeline
    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['codedeploy:*', 's3:*', 'iam:PassRole'],
        resources: ['*'],
      })
    );

  }
}