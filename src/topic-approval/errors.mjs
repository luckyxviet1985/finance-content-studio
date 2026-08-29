export class TopicApprovalError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TopicApprovalError";
    this.code = code;
    this.details = details;
  }
}

export const fail = (code, message, details) => {
  throw new TopicApprovalError(code, message, details);
};
