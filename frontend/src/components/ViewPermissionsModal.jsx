import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const ViewPermissionsModal = ({ user, onClose }) => {
  if (!user) return null

  const defaultFeatures = ['lotManagement', 'manageDamage', 'category', 'products']
  const permissions = user.permissions || []

  const getFeaturePermissions = (feature) =>
    permissions.find(p => p.feature === feature)?.permissions || []

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions of: {user.username}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <div className="font-medium text-gray-800">Full Name</div>
            <div>{user.username} {user.lastName}</div>
          </div>
          <div>
            <div className="font-medium text-gray-800">Role</div>
            <Badge variant={user.role === 'admin' ? 'destructive' : 'outline'}>
              {user.role}
            </Badge>
          </div>
          <div>
            <div className="font-medium text-gray-800">Warehouse</div>
            <div>{user.assignedWarehouse || 'None'}</div>
          </div>
          <div>
            <div className="font-medium text-gray-800">Status</div>
            <Badge variant={user.isActive ? 'default' : 'outline'}>
              {user.isActive ? 'Active' : 'Disabled'}
            </Badge>
          </div>
        </div>

        <div className="mt-6 border rounded-lg overflow-hidden">
          <Table className="text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-1/4">Feature</TableHead>
                <TableHead>Show</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Cancel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaultFeatures.map((feature) => {
                const perms = getFeaturePermissions(feature)
                return (
                  <TableRow key={feature} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{feature}</TableCell>
                    <TableCell>
                      <input type="checkbox" checked={perms.includes('Show')} readOnly />
                    </TableCell>
                    <TableCell>
                      <input type="checkbox" checked={perms.includes('Edit')} readOnly />
                    </TableCell>
                    <TableCell>
                      <input type="checkbox" checked={perms.includes('Cancel')} readOnly />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => onClose(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ViewPermissionsModal
