import { DynamoPostRepository } from "@ph4k/infra";

export class PostService {
  constructor(private readonly repository: DynamoPostRepository) {}

  listPosts() {
    return this.repository.listPosts();
  }
}
