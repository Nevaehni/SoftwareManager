import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PackageManagerInfo {
    name: string;
    available: boolean;
    version?: string;
    error?: string;
}

export class PackageManagerDetector {

    async detectAll(): Promise<PackageManagerInfo[]> {
        const results = await Promise.allSettled([
            this.detectWinget(),
            this.detectChocolatey()
        ]);

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                const managerNames = ['Winget', 'Chocolatey'];
                return {
                    name: managerNames[index],
                    available: false,
                    error: result.reason?.message || 'Detection failed'
                };
            }
        });
    }

    async detectWinget(): Promise<PackageManagerInfo> {
        try {
            const result = await execAsync('winget --version');
            const version = result.stdout.trim();

            return {
                name: 'Winget',
                available: true,
                version: version.replace(/^v/, '') // Remove 'v' prefix if present
            };
        } catch (error) {
            return {
                name: 'Winget',
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async detectChocolatey(): Promise<PackageManagerInfo> {
        try {
            const result = await execAsync('choco --version');
            const version = result.stdout.trim();

            return {
                name: 'Chocolatey',
                available: true,
                version
            };
        } catch (error) {
            return {
                name: 'Chocolatey',
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async isWingetAvailable(): Promise<boolean> {
        const info = await this.detectWinget();
        return info.available;
    }

    async isChocolateyAvailable(): Promise<boolean> {
        const info = await this.detectChocolatey();
        return info.available;
    }

    async getRecommendations(): Promise<string[]> {
        const managers = await this.detectAll();
        const recommendations: string[] = [];

        const winget = managers.find(m => m.name === 'Winget');
        const choco = managers.find(m => m.name === 'Chocolatey');

        if (!winget?.available) {
            recommendations.push(
                'Winget is not available. Install Windows Package Manager from Microsoft Store or GitHub.'
            );
        }

        if (!choco?.available) {
            recommendations.push(
                'Chocolatey is not available. Install from https://chocolatey.org/install'
            );
        }

        if (winget?.available && choco?.available) {
            recommendations.push(
                'Both package managers are available. You can use either or both for software management.'
            );
        }

        return recommendations;
    }
}
