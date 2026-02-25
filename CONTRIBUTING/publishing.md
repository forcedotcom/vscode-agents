# Publishing a New Version

## Automated Release Process (Recommended)

The release process is now automated based on conventional commits. When PRs with `feat:` or `fix:` commits are merged to main, a draft release is automatically created.

### Overview

- **`feat:`** commits trigger a **minor** version bump (e.g., 1.7.0 → 1.8.0)
- **`fix:`** commits trigger a **patch** version bump (e.g., 1.7.0 → 1.7.1)
- Other commit types (`chore:`, `docs:`, etc.) do not trigger releases

### Step 1: Merge PRs to Main

Ensure all commits in your PR follow the [conventional commit format](https://www.conventionalcommits.org/):
- `feat: add new feature` - for new features (minor version bump)
- `fix: resolve bug` - for bug fixes (patch version bump)

### Step 2: Automatic Detection and Draft Release

When your PR is merged to main, the system automatically:
1. ✅ Detects feat/fix commits since the last release
2. ✅ Determines the version bump type
3. ✅ Runs all tests (unit, integration, build)
4. ✅ Builds VSIX artifacts
5. ✅ Generates changelog using conventional-changelog
6. ✅ Bumps version in package.json and package-lock.json
7. ✅ Generates SHA256 checksums
8. ✅ Commits changes back to main
9. ✅ Creates a git tag
10. ✅ Creates a **draft** GitHub Release with instructions
11. ✅ Sends Slack notification to the team

**Note:** You will receive a Slack notification when the draft release is created.

### Step 3: Review Draft Release

1. Go to the [Releases page](https://github.com/forcedotcom/vscode-agents/releases)
2. Find the draft release (it will be at the top with a "Draft" label)
3. Review the auto-generated changelog
4. Verify that all changes are accurately described

### Step 4: Edit Changelog (Optional)

You can edit the changelog before publishing in two ways:

#### Option A: Edit GitHub Release Description
- Click "Edit" button on the draft release
- Modify the changelog section in the release notes
- Click "Save draft"
- The edited version will be used for marketplace listings

#### Option B: Edit CHANGELOG.md File
- Edit the `CHANGELOG.md` file in the repository
- Commit and push your changes to main
- The changes are already in the repo and will be included in future releases
- Then publish the draft release when ready

**Recommendation:** Work with your technical writer to polish the changelog before publishing.

### Step 5: Publish Release

Once you're satisfied with the changelog:
1. Click the **"Publish release"** button on the draft release
2. The system will automatically:
   - ✅ Publish to Microsoft VS Code Marketplace
   - ✅ Publish to Open VSX Registry
   - ✅ Send success notification to Slack

### Step 6: Verify Publication

After publishing, verify the extension is available:
- [Microsoft Marketplace](https://marketplace.visualstudio.com/items?itemName=Salesforce.salesforcedx-vscode-agents)
- [Open VSX Registry](https://open-vsx.org/extension/salesforce/salesforcedx-vscode-agents)

It may take a few minutes for the marketplaces to update.

---

## Manual Release Process (Fallback)

⚠️ **Note:** The manual process below is deprecated and kept only as a fallback for emergency releases. Use the automated process above for normal releases.

### Part I: Initiating a New Release

This part will create a new release branch, generate a changelog, and start a release PR to merge back the release branch into the main branch.

If you just need a refresher:

- _TL;DR:_ Execute the `Initiate New Release` GitHub Action on the `main` branch. Then, send the generated PR with `CHANGELOG.md` changes to our doc writer. Finalize the `CHANGELOG.md` with the approved text, then move on to Part II.

If you want detailed instructions:

1. Go to the `Actions` tab and click `Initiate New Release` GitHub Action.
   <br/><img src="images%2FinitiateNewRelease_action.png" width="150" alt=""/>

2. Run the `Initiate New Release` GitHub Action on the `main` branch.
   <br/><img src="images%2FinitiateNewRelease_workflow_dispatch.png" width="350" alt=""/>

3. After a successful workflow run, new release branch should be created with the name format `release/MM-DD_YYYY-#` where `#` is the run attempt. If you’re running this workflow for the first time, then `#` will be 1. If you are re-running the workflow, then `#` will be iterated by 1.
   <br/><img src="images%2Fgenerated_release_branch.png" width="200" alt=""/>

4. Go to the `Pull Requests` tab and find the generated PR from step 1. Make sure to update the `What issues does this PR fix or reference?` section of the generated PR with the appropriate GUS work item _or_ the GitHub action run URL from step 1 (doing this is required to pass PR validations).
   <br/><img src="images%2Fgenerated_release_pr.png" width="400" alt=""/>

---

### Part II: Updating the Changelog

1. Check out the `release/MM-DD-YYYY-#` branch locally.

   ```
   git fetch origin <release-branch-name>
   git checkout <release-branch-name>
   ```

2. Open the `CHANGELOG.md` file locally.

3. Review the [commits](https://github.com/forcedotcom/vscode-agents/commits/main/) that have been merged to main since the last release. Filter by the date of the last release.

4. Review the `CHANGELOG.md` to confirm that the rest of the public fix and feat commits since the last release have been added to the changelog. Remove all links to PRs and all git hashes.

5. Sync with our doc writer to review and polish the generated `CHANGELOG.md` changes.

6. Ensure that the version number in the changelog matches the version in `package.json` and `package-lock.json`.

7. Commit and push your `CHANGELOG.md` changes to the `release/MM-DD-YYYY-#` branch.
   ```
   npm run prettier
   git add CHANGELOG.md
   git commit -m "chore: updated CHANGELOG.md with approved text"
   git push origin <release-branch-name>
   ```

---

### Part III: Test, Build, And Release

This part will run through test/build verification, updating the SHA for the release, and creating a GitHub tag and release in the repository.

If you just need a refresher:

- _TL;DR:_ Execute the `Test, Build, and Release` GitHub Action on the `release/MM-DD-YYYY-#` branch. Move on to Part III.

If you want detailed instructions:

1. Go to the `Actions` tab again and click the `Test, Build, and Release` GitHub Action.
   <br/><img src="images%2FtestBuildAndRelease_action.png" width="200" alt=""/>

2. Run the `Test, Build, and Release` GitHub Action on the `release` branch.
   <br/><img src="images%2FtestBuildAndRelease_workflow_dispatch.png" width="400" alt=""/>

3. At the very bottom of your `Test, Build, and Release` GitHub Action run, download the generated artifact.
   <br/><img src="images%2Fgenerated_artifact.png" width="300" alt=""/>

---

### Part IV: Publishing the Release and Merging the Changelog

This part will run through steps for publishing a new release.

1. Navigate to each GitHub Action below and execute them on the `release/MM-DD-YYYY-#` branch. The typical order is outlined below to ensure things go out in priority order:
   - `Publish in Microsoft Marketplace`: Publishes to the VSCode marketplace.
   - `Publish in Open VSX Registry`: Publishes to the openvsix marketplace.
2. Ensure that the extension release version in Microsoft Marketplace and Open VSX Registry are now updated (they may take a few minutes to update):
   - Microsoft Marketplace: ~https://marketplace.visualstudio.com/items?itemName=salesforce.vscode-agents~
   - Open VSX Registry: ~https://open-vsx.org/extension/salesforce/vscode-agents~
3. Once the release is available in the Marketplace, uninstall your local extension, and install the version from the Marketplace. Ensure the extension activates, and spot check that Agentforce for Developers functionality still works.

---

### Part V: Merging the Release Branch

This step will commit the updated SHA of our extension and the release notes.

1. Approve and merge the release PR so that the `release/MM-DD-YYYY-#` branch is merged into `main`.
2. Delete the `release/MM-DD-YYYY-#` branch from the repository.

---

### Part VI: Post Publishing Steps

1. Create a post in the `#platform-cli` Slack channel.

Congratulations, you are now done with the release! :sparkles:
