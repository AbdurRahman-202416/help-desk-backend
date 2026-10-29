import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const staffkey = request.headers['x-staff-key'];
    if (!staffkey) {
      throw new UnauthorizedException(
        'Unauthorized Only Staff Can Do This Action',
      );
    }
    if (staffkey !== '#staff1234') {
      throw new ForbiddenException('Staff Key is Invalid, Please Check Your Key');
    }

    return true;
  }
}
