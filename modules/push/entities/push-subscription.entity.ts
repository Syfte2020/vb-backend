import {
Entity,
PrimaryGeneratedColumn,
Column,
CreateDateColumn,
UpdateDateColumn
} from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscription {

@PrimaryGeneratedColumn()
id?:number;

@Column()
user_id?:number;

@Column({
type:'text',
unique:true
})
endpoint?:string;

@Column()
p256dh?:string;

@Column()
auth?:string;

@Column({
nullable:true
})
browser?:string;

@Column({
nullable:true
})
browser_version?:string;

@Column({
nullable:true
})
platform?:string;

@Column({
nullable:true
})
device_type?:string;

@Column({
nullable:true
})
device_name?:string;

@Column({
type:'text',
nullable:true
})
user_agent?:string;

@Column({
default:'granted'
})
permission?:string;

@Column({
default:true
})
is_active?:boolean;

@Column({
type:'datetime',
nullable:true
})
last_used_at?:Date;

@CreateDateColumn()
created_at?:Date;

@UpdateDateColumn()
updated_at?:Date;

}