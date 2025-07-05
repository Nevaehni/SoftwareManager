import { PackageAdapter } from '../../../core/src/package-adapter';
import { shouldBehaveLikePackageAdapter } from './adapter-contract';
import { WingetAdapter } from '../winget-adapter';

describe('WingetAdapter', () => {
    shouldBehaveLikePackageAdapter(() => new WingetAdapter());
});
