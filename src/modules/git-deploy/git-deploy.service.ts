import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class GitDeployService {

  // CHANGE THIS
  private readonly repoPath =
    '/home/your-user/your-project';

  private async git(args: string[]) {
    try {
      const { stdout, stderr } =
        await execFileAsync(
          'git',
          args,
          {
            cwd: this.repoPath,
            maxBuffer: 10 * 1024 * 1024,
          },
        );

      return {
        success: true,
        stdout,
        stderr,
      };

    } catch (error: any) {
      throw new Error(
        error?.stderr ||
        error?.stdout ||
        error?.message ||
        'Git command failed',
      );
    }
  }

  async getBranches() {

    const result = await this.git([
      'branch',
      '-a',
      '--format=%(refname:short)',
    ]);

    const branches = result.stdout
      .split('\n')
      .map(branch => branch.trim())
      .filter(Boolean)
      .filter(branch =>
        !branch.includes('HEAD')
      );

    return {
      success: true,
      branches,
    };
  }


  async mergeToMain(branch: string) {

    // NEVER allow arbitrary shell commands
    // Only allow normal Git branch names.
    if (
      !branch ||
      branch === 'main' ||
      branch.includes('..') ||
      branch.includes(';') ||
      branch.includes('|') ||
      branch.includes('&')
    ) {
      throw new BadRequestException(
        'Invalid branch name',
      );
    }

    try {

      // ==========================================
      // 1. Make sure repository is clean
      // ==========================================

      const status =
        await this.git([
          'status',
          '--porcelain',
        ]);

      if (status.stdout.trim()) {
        throw new Error(
          'Repository has uncommitted changes. Commit or stash them first.',
        );
      }


      // ==========================================
      // 2. Fetch latest GitHub changes
      // ==========================================

      await this.git([
        'fetch',
        'origin',
      ]);


      // ==========================================
      // 3. Checkout main
      // ==========================================

      await this.git([
        'checkout',
        'main',
      ]);


      // ==========================================
      // 4. Update main
      // ==========================================

      await this.git([
        'pull',
        '--ff-only',
        'origin',
        'main',
      ]);


      // ==========================================
      // 5. Check branch exists
      // ==========================================

      await this.git([
        'rev-parse',
        '--verify',
        `origin/${branch}`,
      ]);


      // ==========================================
      // 6. Merge branch
      // ==========================================

      const merge =
        await this.git([
          'merge',
          '--no-ff',
          `origin/${branch}`,
          '-m',
          `Merge ${branch} into main`,
        ]);


      // ==========================================
      // 7. Push main
      // ==========================================

      const push =
        await this.git([
          'push',
          'origin',
          'main',
        ]);


      return {
        success: true,
        message:
          `${branch} merged and pushed to main successfully`,
        mergeOutput:
          merge.stdout,
        pushOutput:
          push.stdout,
      };

    } catch (error: any) {

      // Try to abort an incomplete merge
      try {
        await this.git([
          'merge',
          '--abort',
        ]);
      } catch (_) {}

      throw new InternalServerErrorException({
        success: false,
        message:
          error?.message ||
          'Merge failed',
      });
    }
  }
}