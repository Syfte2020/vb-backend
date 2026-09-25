import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, tap } from "rxjs";
import { ActivityLogsService } from "../activity-logs.service";

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private activityLogsService: ActivityLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {

    const req = context.switchToHttp().getRequest();

    const user = req.user; // 🔥 MUST come from JWT guard
    const ip = req.ip;
    const userAgent = req.headers["user-agent"];

    const moduleName =
      this.reflector.get<string>(
        "activity_module",
        context.getClass(),
      ) || "Unknown";

    const method = req.method;

    return next.handle().pipe(
      tap(async (response) => {

        if (method === "GET") return;
        
        await this.activityLogsService.create({
          action: method,
          module: moduleName,
          module_id: response?.id || null,
          user_id: user?.id || null,   // 🔥 FIXED
          description:
            response?.name
              ? `${method} ${moduleName} - ${response.name}`
              : `${method} ${moduleName}`,

          ip_address: ip,
          user_agent: userAgent,
        });

      }),
    );
  }
}