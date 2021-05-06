// @flow

import type {NodeAddressT} from "../../core/graph";
import type {ReferenceDetector, URL} from "../../core/references";
import type {ReadRepository} from "./mirrorRepository";
import {topicAddress, userAddress, postAddress} from "./address";
import {linksToReferences} from "./references";

/**
 * Discourse ReferenceDetector detector that relies on database lookups.
 */
export class DiscourseReferenceDetector implements ReferenceDetector {
  data: ReadRepository;

  constructor(data: ReadRepository) {
    this.data = data;
  }

  addressFromUrl(url: URL): ?NodeAddressT {
    const [reference] = linksToReferences([url]);
    if (!reference) {
      return null;
    }

    switch (reference.type) {
      case "TOPIC": {
        // Just validating the topic exists.
        if (this.data.topicById(reference.topicId)) {
          return topicAddress(reference.serverUrl, reference.topicId);
        }
        break;
      }

      case "POST": {
        // For posts, we need to convert from topicId + index to a post ID.
        // We're using it to validate the topic and post index exist as well.
        const postId = this.data.findPostInTopic(
          reference.topicId,
          reference.postIndex
        );
        if (postId) {
          return postAddress(reference.serverUrl, postId);
        }
        break;
      }

      case "USER": {
        // Look up the username to validate it exists, and make sure we use
        // the result. As this should correct our capitalization. See #1479.
        const user = this.data.findUser(reference.username);
        if (user) {
          return userAddress(reference.serverUrl, user.username);
        }
        break;
      }

      default: {
        throw new Error(
          `Unexpected reference type: ${(reference.type: empty)}`
        );
      }
    }
  }
}
