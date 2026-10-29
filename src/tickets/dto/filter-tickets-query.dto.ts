import { IsIn, IsOptional, IsString } from "class-validator";

export class FilterTicketsQueryDto {
    @IsOptional()
    @IsString()
    @IsIn(['open', 'closed'])
    status: 'open' | 'closed';

    @IsOptional()
    @IsString()
    @IsIn(['low', 'medium', 'high'])
    priority: 'low' | 'medium' | 'high';
}
