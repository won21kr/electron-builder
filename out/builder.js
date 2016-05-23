"use strict";

const packager_1 = require("./packager");
const gitHubPublisher_1 = require("./gitHubPublisher");
const promise_1 = require("./promise");
const bluebird_1 = require("bluebird");
const repositoryInfo_1 = require("./repositoryInfo");
const util_1 = require("./util");
//noinspection JSUnusedLocalSymbols
const __awaiter = require("./awaiter");
function createPublisher(packager, options, repoSlug) {
    let isPublishOptionGuessed = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

    return __awaiter(this, void 0, void 0, function* () {
        const info = yield repoSlug.getInfo(packager);
        if (info == null) {
            if (isPublishOptionGuessed) {
                return null;
            }
            util_1.log("Cannot detect repository by .git/config");
            throw new Error("Please specify 'repository' in the dev package.json ('" + packager.devPackageFile + "')");
        } else {
            return new gitHubPublisher_1.GitHubPublisher(info.user, info.project, packager.metadata.version, options.githubToken, options.publish !== "onTagOrDraft");
        }
    });
}
exports.createPublisher = createPublisher;
function build(originalOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = Object.assign({
            cscLink: process.env.CSC_LINK,
            csaLink: process.env.CSA_LINK,
            cscKeyPassword: process.env.CSC_KEY_PASSWORD,
            githubToken: process.env.GH_TOKEN || process.env.GH_TEST_TOKEN
        }, originalOptions);
        options.platform = packager_1.normalizePlatforms(options.platform);
        const lifecycleEvent = process.env.npm_lifecycle_event;
        if (options.publish) {
            options.dist = true;
        } else if (options.dist === undefined) {
            options.dist = lifecycleEvent === "dist" || lifecycleEvent === "build" || lifecycleEvent != null && lifecycleEvent.startsWith("dist:");
        }
        let isPublishOptionGuessed = false;
        if (options.publish === undefined) {
            if (lifecycleEvent === "release") {
                options.publish = "always";
            } else if (options.githubToken != null) {
                const tag = process.env.TRAVIS_TAG || process.env.APPVEYOR_REPO_TAG_NAME || process.env.CIRCLE_TAG;
                if (tag != null && tag.length !== 0) {
                    util_1.log("Tag %s is defined, so artifacts will be published", tag);
                    options.publish = "onTag";
                    isPublishOptionGuessed = true;
                } else if ((process.env.TRAVIS || process.env.APPVEYOR || process.env.CIRCLECI || "").toLowerCase() === "true") {
                    util_1.log("CI detected, so artifacts will be published if draft release exists");
                    options.publish = "onTagOrDraft";
                    isPublishOptionGuessed = true;
                }
            }
        }
        const publishTasks = [];
        const repositoryInfo = new repositoryInfo_1.InfoRetriever();
        const packager = new packager_1.Packager(options, repositoryInfo);
        if (options.publish != null && options.publish !== "never") {
            let publisher = null;
            packager.artifactCreated(event => {
                if (publisher == null) {
                    publisher = createPublisher(packager, options, repositoryInfo, isPublishOptionGuessed);
                }
                if (publisher) {
                    publisher.then(it => publishTasks.push(it.upload(event.file, event.artifactName)));
                }
            });
        }
        yield promise_1.executeFinally(packager.build(), errorOccurred => {
            if (errorOccurred) {
                for (let task of publishTasks) {
                    task.cancel();
                }
                return bluebird_1.Promise.resolve(null);
            } else {
                return bluebird_1.Promise.all(publishTasks);
            }
        });
    });
}
exports.build = build;
//# sourceMappingURL=builder.js.map