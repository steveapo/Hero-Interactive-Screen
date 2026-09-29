import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarBadge } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

/** Renders a component at its natural width, then shrinks it to fit a thumbnail tile. */
function Scaled({ width, scale, children }: { width: number; scale: number; children: React.ReactNode }) {
  return (
    <div className="shrink-0 origin-center" style={{ width, transform: `scale(${scale})` }}>
      {children}
    </div>
  )
}

const TABLE_ROWS = [
  ["Widget Pro", "Hardware", "1,200", "$24,000"],
  ["Cloud Suite", "Software", "850", "$42,500"],
  ["Support Plan", "Services", "320", "$9,600"],
]

export const COMPONENT_PREVIEWS: { name: string; preview: React.ReactNode }[] = [
  {
    name: "Accordion",
    preview: (
      <Scaled width={360} scale={0.36}>
        <Accordion type="single" collapsible defaultValue="shipping" className="bg-transparent">
          <AccordionItem value="shipping">
            <AccordionTrigger>What is shipping policy?</AccordionTrigger>
            <AccordionContent>
              We offer free shipping on all orders over $50. Orders are processed within 1–2 business days.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="returns">
            <AccordionTrigger>Do you accept returns?</AccordionTrigger>
          </AccordionItem>
          <AccordionItem value="support">
            <AccordionTrigger>How do I contact support?</AccordionTrigger>
          </AccordionItem>
        </Accordion>
      </Scaled>
    ),
  },
  {
    name: "Alert",
    preview: (
      <Scaled width={300} scale={0.4}>
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
        </Alert>
      </Scaled>
    ),
  },
  {
    name: "Avatar",
    preview: (
      <Avatar size="lg">
        <AvatarBadge />
      </Avatar>
    ),
  },
  { name: "Badge", preview: <Badge>Badge</Badge> },
  { name: "Button", preview: <Button>Button</Button> },
  {
    name: "Card",
    preview: (
      <Scaled width={320} scale={0.4}>
        <Card>
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
            <CardDescription>A summary of your current project status and recent activity.</CardDescription>
          </CardHeader>
          <CardContent>Everything is on track. 3 tasks completed this week, 2 pending review.</CardContent>
          <CardFooter className="text-muted-foreground">Last updated just now</CardFooter>
        </Card>
      </Scaled>
    ),
  },
  {
    name: "Checkbox",
    preview: (
      <div className="flex shrink-0 items-center gap-2">
        <Checkbox id="preview-terms" defaultChecked />
        <Label htmlFor="preview-terms">Accept terms and conditions</Label>
      </div>
    ),
  },
  {
    name: "Input",
    preview: <Input defaultValue="42" className="w-44 shrink-0" />,
  },
  { name: "Label", preview: <Label>Email address</Label> },
  {
    name: "RadioGroup",
    preview: (
      <Scaled width={140} scale={0.8}>
        <RadioGroup defaultValue="comfortable" className="gap-2">
          {["Default", "Comfortable", "Compact"].map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option.toLowerCase()} id={`preview-${option}`} />
              <Label htmlFor={`preview-${option}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      </Scaled>
    ),
  },
  {
    name: "Select",
    preview: (
      <Scaled width={180} scale={0.8}>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      </Scaled>
    ),
  },
  { name: "Slider", preview: <Slider defaultValue={[50]} max={100} className="w-24" /> },
  { name: "Spinner", preview: <Spinner /> },
  { name: "Switch", preview: <Switch /> },
  {
    name: "Table",
    preview: (
      <Scaled width={340} scale={0.34}>
        <Table>
          <TableCaption>Q4 2024 sales summary</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Units Sold</TableHead>
              <TableHead>Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((row) => (
              <TableRow key={row[0]}>
                {row.map((cell) => (
                  <TableCell key={cell}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell>$76,100</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Scaled>
    ),
  },
  {
    name: "Textarea",
    preview: <Textarea placeholder="Type your message here..." className="h-full min-h-0 w-full resize-none rounded-none" />,
  },
]
