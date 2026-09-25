import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { createTransaction } from "@/features/transaction/action";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["income", "expense"], {
    error: "Type is required",
  }),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
});

export default function CreateTransactionCard({
  refetch,
}: {
  refetch: () => void;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      type: "income",
      category: "",
      date: "",
      description: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const formatedData = {
        ...data,
        amount: parseFloat(data.amount),
      };

      return createTransaction(formatedData);
    },
    onSuccess: () => {
      form.reset();
      refetch();
      toast.success("Transaction created successfully!");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create transaction",
      );
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutate(data);
  };

  return (
    <Card className="w-full gap-2 h-fit">
      <CardHeader className="gap-0">
        <CardTitle>Create Transaction</CardTitle>
        <CardDescription>Add a new financial activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-3">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="form-amount">Amount</FieldLabel>
                  <Input
                    {...field}
                    id="form-amount"
                    placeholder="0,00"
                    autoComplete="off"
                    type="number"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="form-type">Type</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="form-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="form-category">Category</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="form-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                      <SelectItem value="Transportation">
                        Transportation
                      </SelectItem>
                      <SelectItem value="Entertainment">
                        Entertainment
                      </SelectItem>
                      <SelectItem value="Shopping">Shopping</SelectItem>
                      <SelectItem value="Housing">Housing</SelectItem>
                      <SelectItem value="Salary">Salary</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="form-date">Date</FieldLabel>
                  <DatePicker
                    id="form-date"
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date) =>
                      field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="form-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="form-description"
                    placeholder="Enter description"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Button
              size="lg"
              type="submit"
              disabled={!form.formState.isValid || isPending}
            >
              {isPending ? "Creating..." : "Create Transaction"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
