import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  deleteContact,
  listContacts,
  setContactPgpKey,
} from "../../lib/api/endpoints/contacts";
import { useToastStore } from "../../lib/state/toastStore";
import { Key, Trash, UserPlus, Users } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { ApiError, type Contact } from "../../lib/api/types";

export function ContactsTab() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [keyEmail, setKeyEmail] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const client = useQueryClient();
  const toast = useToastStore((state) => state.show);
  const contactQuery = useQuery({ queryKey: ["contacts"], queryFn: listContacts });
  const contacts = contactQuery.data ?? [];
  const refresh = () => client.invalidateQueries({ queryKey: ["contacts"] });
  const add = useMutation({
    mutationFn: () => createContact(name, email),
    onSuccess: () => {
      setName("");
      setEmail("");
      refresh();
      toast("Contact saved");
    },
    onError: () => toast("Could not save contact."),
  });
  const remove = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      setContactToDelete(null);
      refresh();
      toast("Contact deleted");
    },
    onError: () => toast("Could not delete contact."),
  });
  const addKey = useMutation({
    mutationFn: () => setContactPgpKey(keyEmail, publicKey),
    onSuccess: () => {
      setKeyEmail("");
      setPublicKey("");
      refresh();
      toast("Contact PGP key saved");
    },
    onError: () => toast("That public key could not be imported."),
  });
  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Users weight="duotone" />
        </div>
        <div>
          <h1>Contacts</h1>
          <p>Save frequent recipients and their public encryption keys.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-title-row">
          <UserPlus weight="duotone" />
          <div>
            <h2>Add contact</h2>
            <p>Contacts are used for address suggestions while composing.</p>
          </div>
        </div>
        <div className="settings-inline-form settings-contact-form">
          <Field
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
          />
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <Button loading={add.isPending} disabled={!email.trim()} onClick={() => add.mutate()}>
            Save contact
          </Button>
        </div>
      </section>
      <section className="settings-section-card">
        <h2>Address book</h2>
        <div className="settings-list">
          {contactQuery.isPending ? (
            <Skeleton lines={3} />
          ) : contactQuery.isError ? (
            <ErrorState
              title="Contacts could not be loaded"
              description={
                contactQuery.error instanceof ApiError
                  ? contactQuery.error.message
                  : "Check your connection and try again."
              }
              onRetry={() => void contactQuery.refetch()}
            />
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No contacts saved"
              description="Contacts you add will appear here."
            />
          ) : null}
          {!contactQuery.isError &&
            contacts.map((contact) => (
              <div className="settings-list-row" key={contact.id}>
                <div>
                  <strong>{contact.displayName}</strong>
                  <span>
                    {contact.email}
                    {contact.pgpPublicKey ? " - PGP key saved" : ""}
                  </span>
                </div>
                <IconButton
                  danger
                  label={`Delete ${contact.displayName}`}
                  icon={<Trash />}
                  onClick={() => setContactToDelete(contact)}
                />
              </div>
            ))}
        </div>
      </section>
      <section className="settings-section-card">
        <div className="settings-card-title-row">
          <Key weight="duotone" />
          <div>
            <h2>Contact PGP key</h2>
            <p>Attach an armored public key to an existing contact email.</p>
          </div>
        </div>
        <Field
          label="Contact email"
          type="email"
          value={keyEmail}
          onChange={(event) => setKeyEmail(event.target.value)}
          placeholder="name@example.com"
        />
        <label className="ui-field">
          <span className="ui-field-label">Armored public key</span>
          <textarea
            className="settings-key-area"
            value={publicKey}
            onChange={(event) => setPublicKey(event.target.value)}
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
          />
        </label>
        <Button
          loading={addKey.isPending}
          disabled={!keyEmail.trim() || !publicKey.trim()}
          onClick={() => addKey.mutate()}
        >
          Import public key
        </Button>
      </section>
      {contactToDelete && (
        <ConfirmationDialog
          title={`Delete ${contactToDelete.displayName}?`}
          description="This contact and its saved public key will be removed from your address book."
          confirmLabel="Delete contact"
          busy={remove.isPending}
          onCancel={() => setContactToDelete(null)}
          onConfirm={() => remove.mutate(contactToDelete.id)}
        />
      )}
    </div>
  );
}
