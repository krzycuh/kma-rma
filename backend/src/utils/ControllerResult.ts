export interface ControllerResult {
  getStatusCode(): number;
  getContentType(): string;
  getBody(): string;
}

export class SuccessObject implements ControllerResult {
  constructor(private jsonObject: any) {}
  getStatusCode(): number { return 200; }
  getContentType(): string { return 'application/json'; }
  getBody(): string { return JSON.stringify(this.jsonObject); }
}

export class SuccessMessage implements ControllerResult {
  constructor(private message: string) {}
  getStatusCode(): number { return 200; }
  getContentType(): string { return 'text/plain'; }
  getBody(): string { return this.message; }
}

export class Error implements ControllerResult {
  constructor(private message: string, private statusCode: number = 500) {}
  getStatusCode(): number { return this.statusCode; }
  getContentType(): string { return 'text/plain'; }
  getBody(): string { return this.message; }
}


