import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user_roles")
export class UserRole {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: "user_id",
    type: "int",
  })
  userId?: number;

  @Column({
    name: "role_id",
    type: "int",
  })
  roleId?: number;

  @CreateDateColumn({
    name: "created_at",
  })
  createdAt?: Date;

  @UpdateDateColumn({
    name: "updated_at",
  })
  updatedAt?: Date;

  @Column({
    name: "auto_role",
    type: "tinyint",
    default: 0,
  })
  autoRole?: number;

  @Column({
    name: "mask_data",
    type: "tinyint",
    default: 0,
  })
  maskData?: number;
}